// ============================================================================
// Spider Logger — legacy compatibility layer, silent by default
// ============================================================================
//
// 设计原则：
//   - **stdout 严格保留给 CLI 的最终 JSON 结果**。日志一律走 stderr。
//   - 通过 levels 控制冗余度，trace/debug/info/warn/error。
//   - 通过 scope 区分模块（如 "goal:executor", "skill:dedao", "page:retry"）。
//   - 任何字段都可以在调用时附加（避免 console.log 字符串拼接）。
//   - 错误信息（仅错误！）可被 Skill 收集并附到 SkillResult.metadata.errorInfo
//     供 AI 消费方使用，普通 info/warn 不会出现在最终结果中。
//
// 环境变量：
//   SPIDER_LOG_LEVEL  = silent | error | warn | info | debug | trace（默认 silent）
//   SPIDER_LOG_FORMAT = text | json（默认 text）
// ============================================================================

export const LOG_LEVELS = [
  "silent",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_RANK: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

export interface LogRecord {
  level: Exclude<LogLevel, "silent">;
  timestamp: string;
  scope: string;
  message: string;
  fields?: Record<string, unknown>;
  err?: { name?: string; message: string; stack?: string };
}

export type LogTransport = (record: LogRecord) => void;

export interface LoggerOptions {
  level?: LogLevel;
  transport?: LogTransport;
  /** 默认附加字段（如 skillId） — 与每条记录的 fields 合并 */
  baseFields?: Record<string, unknown>;
}

export interface ILogger {
  child(scope: string, baseFields?: Record<string, unknown>): ILogger;
  trace(message: string, fields?: Record<string, unknown>): void;
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(
    message: string,
    errOrFields?: unknown,
    fields?: Record<string, unknown>,
  ): void;
  /** 当前 level 是否会输出指定级别 — 用于跳过昂贵的 fields 构造 */
  isEnabled(level: Exclude<LogLevel, "silent">): boolean;
}

// ============================================================================
// 默认 transport：兼容接口保留，但项目内置实现不打印日志
// ============================================================================

function pickFormat(): "text" | "json" {
  const v =
    (typeof process !== "undefined" && process.env?.SPIDER_LOG_FORMAT) || "";
  return v.toLowerCase() === "json" ? "json" : "text";
}

function pickLevel(): LogLevel {
  const v =
    (typeof process !== "undefined" && process.env?.SPIDER_LOG_LEVEL) || "";
  const lv = v.toLowerCase() as LogLevel;
  return LOG_LEVELS.includes(lv) ? lv : "silent";
}

const defaultTransport = (_format: "text" | "json"): LogTransport => {
  return () => undefined;
};

// ============================================================================
// SpiderLogger 实现
// ============================================================================

export class SpiderLogger implements ILogger {
  private readonly level: LogLevel;
  private readonly transport: LogTransport;
  private readonly scope: string;
  private readonly baseFields: Record<string, unknown>;

  constructor(scope: string, options: LoggerOptions = {}) {
    this.scope = scope;
    this.level = options.level ?? pickLevel();
    this.transport = options.transport ?? defaultTransport(pickFormat());
    this.baseFields = options.baseFields ?? {};
  }

  child(scope: string, baseFields?: Record<string, unknown>): ILogger {
    return new SpiderLogger(`${this.scope}.${scope}`, {
      level: this.level,
      transport: this.transport,
      baseFields: { ...this.baseFields, ...(baseFields ?? {}) },
    });
  }

  isEnabled(level: Exclude<LogLevel, "silent">): boolean {
    return LEVEL_RANK[this.level] >= LEVEL_RANK[level];
  }

  trace(m: string, f?: Record<string, unknown>) {
    this.emit("trace", m, f);
  }
  debug(m: string, f?: Record<string, unknown>) {
    this.emit("debug", m, f);
  }
  info(m: string, f?: Record<string, unknown>) {
    this.emit("info", m, f);
  }
  warn(m: string, f?: Record<string, unknown>) {
    this.emit("warn", m, f);
  }

  error(
    message: string,
    errOrFields?: unknown,
    fields?: Record<string, unknown>,
  ): void {
    if (!this.isEnabled("error")) return;
    let err: LogRecord["err"];
    let mergedFields: Record<string, unknown> | undefined;
    if (errOrFields instanceof Error) {
      err = {
        name: errOrFields.name,
        message: errOrFields.message,
        stack: errOrFields.stack,
      };
      mergedFields = fields;
    } else if (errOrFields && typeof errOrFields === "object") {
      mergedFields = errOrFields as Record<string, unknown>;
    }
    this.transport({
      level: "error",
      timestamp: new Date().toISOString(),
      scope: this.scope,
      message,
      fields: this.mergeFields(mergedFields),
      err,
    });
  }

  private emit(
    level: Exclude<LogLevel, "silent">,
    message: string,
    fields?: Record<string, unknown>,
  ): void {
    if (!this.isEnabled(level)) return;
    this.transport({
      level,
      timestamp: new Date().toISOString(),
      scope: this.scope,
      message,
      fields: this.mergeFields(fields),
    });
  }

  private mergeFields(
    fields?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!fields && Object.keys(this.baseFields).length === 0) return undefined;
    return { ...this.baseFields, ...(fields ?? {}) };
  }
}

// ============================================================================
// 公共单例与工厂
// ============================================================================

/** 完全静默日志（用于 silent 模式 / 测试） */
export const noopLogger: ILogger = {
  child: () => noopLogger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  isEnabled: () => false,
};

let rootLogger: ILogger | undefined;

/** 获取全局根 logger（lazy 初始化，使用环境变量配置） */
export function getRootLogger(): ILogger {
  if (!rootLogger) rootLogger = new SpiderLogger("spider");
  return rootLogger;
}

/** 测试场景下手动注入根 logger */
export function setRootLogger(logger: ILogger): void {
  rootLogger = logger;
}

/** 创建子 logger — 推荐方式 */
export function createLogger(
  scope: string,
  baseFields?: Record<string, unknown>,
): ILogger {
  return getRootLogger().child(scope, baseFields);
}
