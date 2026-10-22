import { Socket } from "net";
import type { SkillRegistry } from "../skill/registry";
import { SpiderError } from "../errors";
import { setRootLogger, noopLogger } from "../observability/logger";
import { runRootTrace } from "../observability/trace-context";
import {
  createLiveRuntime,
  shutdownLiveRuntime,
  runWithRuntime,
} from "../runtime";
import { resolveStorageRoot, ensureGitignore } from "../storage/resolve-root";
import { runObsCLI } from "./obs";
import { runContentCLI } from "./content";
import {
  verifyLicense,
  issuePassToken,
  assertPassToken,
} from "../license";

// ============================================================================
// CLI 配置
// ============================================================================

export interface CLIOptions {
  /** CLI 名称（用于 help 提示） */
  name: string;
  /** 用法示例 */
  example: string;
  /** Chrome 远程调试主机（`BROWSER_URL` 环境变量整体覆盖 host:port） */
  chromeHost?: string;
  /** Chrome 远程调试端口（`BROWSER_URL` 环境变量整体覆盖 host:port） */
  chromePort?: number;
  /** 全局超时（毫秒） */
  timeoutMs?: number;
  /** 是否静默执行 Skill */
  silent?: boolean;
  /** 浏览器端点配置 JSON（优先级高于 chromeHost/chromePort） */
  browserEndpoints?: string;
}

// ============================================================================
// 内部工具
// ============================================================================

function fatal(message: string): never {
  const kindMatch = /^\[([\w-]+)\]\s*/.exec(message);
  const errorInfo = {
    kind: kindMatch ? kindMatch[1] : "pipeline-error",
    message: kindMatch ? message.slice(kindMatch[0].length) : message,
  };
  process.stdout.write(
    JSON.stringify({ success: false, error: message, metadata: { errorInfo } }) +
      "\n",
  );
  process.exit(1);
}

function checkPort(
  host: string,
  port: number,
  timeoutMs = 5000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`连接 ${host}:${port} 超时（${timeoutMs}ms）`));
    }, timeoutMs);
    socket
      .connect(port, host, () => {
        clearTimeout(timer);
        socket.destroy();
        resolve();
      })
      .on("error", (err) => {
        clearTimeout(timer);
        reject(
          new Error(
            `无法连接 ${host}:${port} — ${err.message}。请先启动 Chrome：chrome --remote-debugging-port=${port}`,
          ),
        );
      });
  });
}

// ============================================================================
// CLI 入口
// ============================================================================

/**
 * 通用 CLI 入口 — 所有 Spider 共享
 *
 * 用法：
 *   node <entry> --list
 *   node <entry> <skill-id> [params-json]
 */
export function runCLI(
  createRegistry: (browserURL?: string, storageRoot?: string) => SkillRegistry,
  options: CLIOptions,
): void {
  // BROWSER_URL 环境变量整体覆盖 host:port（与 rules/spider-runtime.md §1 的契约一致）；
  // 解析失败则忽略并退回代码配置，连接问题交给端口预检揭示。
  let chromeHost = options.chromeHost ?? "127.0.0.1";
  let chromePort = options.chromePort ?? 4444;
  const envBrowserURL = process.env.BROWSER_URL?.trim();
  if (envBrowserURL) {
    try {
      const u = new URL(envBrowserURL);
      chromeHost = u.hostname || chromeHost;
      chromePort = u.port ? Number(u.port) : chromePort;
    } catch {
      /* 非法 BROWSER_URL 忽略 */
    }
  }
  const timeoutMs = options.timeoutMs ?? 120_000;
  const silent = options.silent ?? false;
  const browserURL = `http://${chromeHost}:${chromePort}`;

  // ── 装配 LiveRuntime + sink（一次性、幂等）──
  const { runtime, installedSinks } = createLiveRuntime();
  const obsCfg = runtime.config;

  // ── Logger 默认静默策略 ──
  // 用户要求："既然可观测移到了这里，原有的log就应当关闭了"
  // 规则：
  //   - silent CLI 选项 → 永远 noop
  //   - obs 启用时默认 noop（事件已落库）
  //   - legacy logger 仅保留兼容，不作为项目诊断通道
  if (silent || obsCfg.enabled) {
    setRootLogger(noopLogger);
  }

  /**
   * 解析 rationale / caller / traceId。
   * 优先级：CLI flag > ENV。
   * 设计原则：AI 传参要简洁 — 不从 skill 业务参数里提取元数据，
   * 避免 "_meta" 污染业务接口与反复说明给 AI。
   */
  const extractMeta = (
    argv: string[],
  ): {
    rationale?: string;
    caller?: string;
    traceId?: string;
  } => {
    let rationale: string | undefined;
    let caller: string | undefined;
    let traceId: string | undefined;
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--rationale" && argv[i + 1]) rationale = argv[i + 1];
      if (argv[i] === "--caller" && argv[i + 1]) caller = argv[i + 1];
      if (argv[i] === "--trace-id" && argv[i + 1]) traceId = argv[i + 1];
    }
    return {
      rationale: rationale ?? process.env.SPIDER_RATIONALE,
      caller: caller ?? process.env.SPIDER_CALLER,
      traceId: traceId ?? process.env.SPIDER_TRACE_ID,
    };
  };

  /** 提取 --storage-dir <path>（优先级最高） */
  const extractStorageFlag = (argv: string[]): string | undefined => {
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--storage-dir" && argv[i + 1]) return argv[i + 1];
    }
    return undefined;
  };

  /** 提取 --license <path> */
  const extractLicenseFlag = (argv: string[]): string | undefined => {
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--license" && argv[i + 1]) return argv[i + 1];
    }
    return undefined;
  };

  /** 把 obs / projection / storage 相关 flag 从 argv 中移除，避免污染下游解析 */
  const stripObsFlags = (argv: string[]): string[] => {
    const out: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      if (
        argv[i] === "--rationale" ||
        argv[i] === "--caller" ||
        argv[i] === "--trace-id" ||
        argv[i] === "--storage-dir" ||
        argv[i] === "--license"
      ) {
        i++;
        continue;
      }
      if (argv[i] === "--raw") continue;
      out.push(argv[i]);
    }
    return out;
  };

  const hasRawFlag = (argv: string[]): boolean =>
    argv.some((a) => a === "--raw");

  async function main() {
    const rawArgs = process.argv.slice(2);

    if (rawArgs.length === 0 || rawArgs[0] === "--help") {
      const help = {
        usage: `node <entry> <skill-id> [params-json] [--rationale "..."] [--caller "..."] [--raw]`,
        commands: {
          "--list": "列出所有可用 Skill（输出 JSON 数组）",
          "--help": "显示帮助信息",
          "--raw":
            "跳过 ProjectionPipeline，直接输出 normalize 后的原始数据（取代旧的 XHS_RAW=1 环境变量）",
          "--storage-dir <path>":
            "覆盖 Skill 运行时数据根（默认 <gitRoot>/.spider 或 <cwd>/.spider）",
          "--license <path>":
            "指定 License 文件路径（默认从 ~/.spider/.env 的 SPIDER_LICENSE 读取）",
          "obs <subcommand>":
            "查询观测数据（ls / recent / trace / http / slow / errors / body）",
        },
        observability: {
          enabled: obsCfg.enabled,
          dir: obsCfg.dir,
          sinks: installedSinks,
          envVars: {
            SPIDER_OBS_DIR: "观测数据根目录（默认 ~/.spider/obs）",
            SPIDER_STORAGE_DIR:
              "Skill 运行时数据根（默认就近：<gitRoot>/.spider 或 <cwd>/.spider）",
            SPIDER_OBS_SINKS: "jsonl",
            SPIDER_OBS_DISABLE: '"1" 完全禁用',
            SPIDER_RATIONALE: "AI 调用动机（亦可 --rationale）",
            SPIDER_CALLER: "调用方标识（亦可 --caller）",
            SPIDER_TRACE_ID: "复用已有 traceId（亦可 --trace-id）",
            SPIDER_LOG_LEVEL: "legacy 兼容字段（默认 noop）",
          },
        },
        example: options.example,
      };
      process.stdout.write(JSON.stringify(help, null, 2) + "\n");
      return;
    }

    // ── obs 查询子命令（不需要浏览器、不进入 trace）──
    if (rawArgs[0] === "obs") {
      const code = await runObsCLI(rawArgs.slice(1));
      process.exitCode = code;
      return;
    }

    // ── content 查询子命令（内容可观测；就近读取 storageRoot 下各平台 manifest）──
    if (rawArgs[0] === "content") {
      const root = resolveStorageRoot({ cliFlag: extractStorageFlag(rawArgs) });
      const code = await runContentCLI(stripObsFlags(rawArgs).slice(1), root);
      process.exitCode = code;
      return;
    }

    const storageRoot = resolveStorageRoot({
      cliFlag: extractStorageFlag(rawArgs),
    });
    // 若 storageRoot 在 git 工作区根下，幂等地写 .gitignore（仅一次）
    await ensureGitignore(storageRoot).catch(() => {
      /* gitignore 维护是 best-effort，失败不阻断 skill */
    });
    const args = stripObsFlags(rawArgs);
    const registry = createRegistry(browserURL, storageRoot);

    // ── License 闸门（主校验点）──
    // 失败即整体拒绝执行，不区分模块档位。
    const lic = verifyLicense({
      skillName: options.name,
      licensePath: extractLicenseFlag(rawArgs),
    });
    if (lic.ok === false) {
      process.stdout.write(
        JSON.stringify(
          {
            success: false,
            error: lic.message,
            errorInfo: { kind: "license-invalid", reason: lic.reason },
          },
          null,
          2,
        ) + "\n",
      );
      process.exit(1);
      throw new Error("unreachable");
    }
    const passToken = issuePassToken(lic.payload);

    if (args[0] === "--list") {
      // L4 冗余校验点 #1
      if (!assertPassToken(passToken)) process.exit(1);
      const skills = registry.list();
      process.stdout.write(JSON.stringify(skills, null, 2) + "\n");
      return;
    }

    const skillId = args[0];
    let params: Record<string, unknown> = {};

    if (args[1]) {
      try {
        params = JSON.parse(args[1]);
      } catch {
        fatal(`无法解析参数 JSON: ${args[1]}`);
      }
    }

    const { rationale, caller, traceId } = extractMeta(rawArgs);

    try {
      await checkPort(chromeHost, chromePort);
    } catch (err) {
      fatal(
        `[browser-unavailable] ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // ── 在 root trace 内执行 skill（同时被 Runtime ALS 包裹）──
    await runWithRuntime(runtime, () =>
      runRootTrace({ caller, rationale, traceId }, async () => {
        const startedAt = Date.now();
        runtime.events.emit({
          kind: "task.start",
          caller,
          rationale,
          argv: rawArgs,
          pid: process.pid,
          cwd: process.cwd(),
        });

        let exitCode = 0;
        let errorMsg: string | undefined;
        try {
          // L4 冗余校验点 #2：放行令牌须与主校验产物一致
          if (!assertPassToken(passToken)) {
            throw new Error("[license-invalid] 授权校验未通过");
          }
          const result = await registry.execute(skillId, params, {
            silent,
            projectionMode: hasRawFlag(rawArgs) ? "raw" : "normal",
          });
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } catch (err) {
          errorMsg = err instanceof Error ? err.message : String(err);
          const errorInfo =
            err instanceof SpiderError
              ? err.toErrorInfo()
              : {
                  kind: "pipeline-error" as const,
                  category: "pipeline" as const,
                  message: errorMsg,
                };
          process.stdout.write(
            JSON.stringify(
              { success: false, error: errorMsg, metadata: { errorInfo } },
              null,
              2,
            ) + "\n",
          );
          exitCode = 1;
        } finally {
          runtime.events.emit({
            kind: "task.end",
            durationMs: Date.now() - startedAt,
            status: errorMsg ? "failure" : "success",
            exitCode,
            error: errorMsg,
          });
        }
        process.exitCode = exitCode;
      }),
    );
  }

  // 全局超时兜底
  const timeout = setTimeout(() => {
    fatal(`全局超时（${timeoutMs}ms），强制退出`);
  }, timeoutMs);
  timeout.unref();

  main()
    .catch((err) => {
      fatal(err instanceof Error ? err.message : String(err));
    })
    .finally(async () => {
      clearTimeout(timeout);
      try {
        await shutdownLiveRuntime(runtime);
      } catch {
        /* ignore */
      }
      // 给异步清理（浏览器断开、文件句柄关闭等）一个短暂窗口，
      // 然后强制退出以避免第三方库残留定时器（如 rsshub puppeteer 30s browser.close()）保活进程。
      setTimeout(() => process.exit(process.exitCode ?? 0), 500).unref();
    });
}
