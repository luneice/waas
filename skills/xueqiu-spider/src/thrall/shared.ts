/**
 * 端点族共享的 Goal 逻辑
 *
 * 四张报表的入参、信封、翻页机制完全一致，差异仅在 `list[]` 字段集，
 * 故翻页游标推进、信封解包、错误判定全部在此共享。
 *
 * ⚠️ 本文件的函数会被端点方法体调用，而端点方法体是**无 this 调用**的
 * （executor 内是裸调 `fn(validated, page)`）—— 所以这里全是**模块级纯函数**，
 * 不得依赖任何实例状态。
 */
import {
  Goal,
  Endpoint,
  Paginated,
  Aggregate,
  BaseGoal,
  GoalContext,
  NotLoggedInError,
  UpstreamShapeChangedError,
} from "@spider/core";
import type { GoalDefaults } from "@spider/core";
import { DEFAULT_PAGE_SIZE, XUEQIU_SITE, STOCK_API_BASE } from "@src/constants";
import type {
  RawFinanceEnvelope,
  RawPeriodBase,
  ValuePair,
  RawValuePair,
  FinanceGoalResult,
} from "@src/types/common.types";

/**
 * Goal 层共享默认值。
 *
 * `credentials: "include"` 的依据：
 *   - 上游响应头 `access-control-allow-credentials: true`
 *   - 且 ACAO 回显具体 Origin（`https://xueqiu.com`）而非 `*`
 *   —— 二者共同证明这是**带凭据的跨域请求**。
 *
 * 实测佐证：curl 带齐 Origin/Referer/UA 但**不带 Cookie** → HTTP 400 + `400016`。
 * （HAR 中看不到 cookie 头是 Chrome 导出时的常规脱敏，不代表未发送。）
 *
 * 凭据由浏览器在页面上下文内自动附带，**Node 侧全程不接触 token**。
 *
 * 注：Origin / Referer / Cookie 三个头由浏览器在页面上下文内自动补齐，
 * 不需要（也不应该）手写 —— 手写 Origin 会被浏览器忽略且属于 forbidden header。
 */
export const SHARED_GOAL_DEFAULTS: GoalDefaults = {
  credentials: "include",
  /** 站点节流基线：串行请求间隔，避免翻页时打得太密 */
  interval: 300,
  concurrency: 3,
};

/** 上游业务错误码：登录态缺失或失效 */
const ERROR_CODE_NOT_LOGGED_IN = "400016";

/**
 * 解包端点族统一响应信封，返回 `data.list`。
 *
 * 🔴 **必须先判 error_code，再判 list** —— 鉴权失败时上游**同样返回
 * `data.list: []`**。若只看 list 长度，会把「未登录」误报成
 * 「该股票无财务数据」，Agent 拿到后会给用户完全错误的结论。
 *
 * @param scope 抛错时的 scope（= skill id）
 */
export function unwrapFinanceEnvelope<TPeriod extends RawPeriodBase>(
  response: RawFinanceEnvelope<TPeriod> | null | undefined,
  scope: string,
): TPeriod[] {
  if (!response || typeof response !== "object") {
    throw new UpstreamShapeChangedError("上游响应不是对象，契约可能已变更", {
      scope,
      details: { received: typeof response },
    });
  }

  const rawCode = response.error_code;

  // ⚠️ error_code 类型会漂移：成功为 number 0，失败为 string（如 "400016"）
  //    必须归一化后比较，且不能只看 HTTP 状态码。
  const normalizedCode = rawCode === undefined || rawCode === null ? 0 : Number(rawCode);

  if (Number.isNaN(normalizedCode)) {
    throw new UpstreamShapeChangedError("error_code 无法归一化为数字", {
      scope,
      details: { errorCode: rawCode },
    });
  }

  if (normalizedCode !== 0) {
    const description = response.error_description ?? "";

    if (String(rawCode) === ERROR_CODE_NOT_LOGGED_IN) {
      throw new NotLoggedInError(
        `雪球登录态缺失或已失效（${rawCode}）：${description}。` +
          `请在调试浏览器内登录 ${XUEQIU_SITE} 后重试`,
        { scope, details: { errorCode: rawCode } },
      );
    }

    throw new UpstreamShapeChangedError(
      `上游返回业务错误 ${rawCode}：${description}`,
      { scope, details: { errorCode: rawCode, description } },
    );
  }

  const list = response.data?.list;
  return Array.isArray(list) ? list : [];
}

/**
 * 计算下一页的翻页游标。
 *
 * 上游 `timestamp` 参数的语义是「返回 `report_date <= timestamp` 的记录」，
 * **不是防缓存参数**（实测传当前时间与传空串返回完全一致）。
 *
 * 两个关键点：
 *   - **`+1` 是必需的**：比较为闭区间，直接传末条 report_date 会重复返回该条。
 *   - **终止判据只能靠 `list.length < count`** —— 上游不返回 has_more / total。
 *
 * 返回 `null` 时 executor 自动终止翻页（见 core executor.ts 的 cursor.getNext）。
 */
export function nextFinanceCursor<TPeriod extends RawPeriodBase>(
  periods: TPeriod[],
  pageSize: number = DEFAULT_PAGE_SIZE,
): string | null {
  // 不足一页 → 已到最早一期
  if (periods.length < pageSize) return null;

  const last = periods[periods.length - 1];
  const lastDate = last?.report_date;
  if (typeof lastDate !== "number" || !Number.isFinite(lastDate)) return null;

  return String(lastDate + 1);
}

/**
 * 归一化二元组。
 *
 * ⚠️ **不得用 `value || null` 一类写法** —— 会把真实的 `0`
 * （如 `lt_payable_sum: [0.0, null]`）误吞成 null，违反
 * CLAUDE.md §3.5「null = 数据源不提供，0 = 值确实为零，二者不可混用」。
 *
 * 同比原样透传（不做 ×100 / ÷100），口径由信封的 units / meta.semantics 声明。
 */
export function toValuePair(raw: RawValuePair | undefined | null): ValuePair {
  if (!Array.isArray(raw)) return { value: null, yoy: null };

  const value = typeof raw[0] === "number" && Number.isFinite(raw[0]) ? raw[0] : null;
  const yoy = typeof raw[1] === "number" && Number.isFinite(raw[1]) ? raw[1] : null;

  return { value, yoy };
}

/** 判定是否为单季口径（`type` 以 S 开头，report_name 措辞为「…季度」） */
export function isSingleQuarterType(type: string): boolean {
  return /^S\d?$/i.test(type);
}

/** 构造财务端点的查询参数 */
export function buildFinanceQuery(
  symbol: string,
  type: string,
  count: number,
  cursor?: string,
): Record<string, unknown> {
  return {
    symbol,
    type,
    is_detail: true,
    count,
    // 首页传空串（实测与传当前时间戳等价）；续取传上页末条 report_date + 1
    timestamp: cursor ?? "",
  };
}

// ============================================================================
// 泛型 Goal 工厂
// ============================================================================

/** Goal 入参 —— 由 Skill 的 normalizeParams 归一化后经 ctx.params 传入 */
export interface FinanceGoalParams {
  symbol: string;
  type: string;
  count: number;
  maxPages: number;
  [key: string]: unknown;
}

/** 构造一个财务报表 Goal 所需的坐标 */
export interface FinanceGoalSpec {
  /** 同时用作 @Goal.id 与错误 scope */
  scope: string;
  /** Goal 中文名 */
  name: string;
  /** 端点路径（相对 STOCK_API_BASE） */
  path: string;
}

/**
 * 泛型财务 Goal 工厂 —— 四张报表共用。
 *
 * 四端点的入参、信封、翻页机制完全一致，差异仅在 `list[]` 的字段集
 * （由泛型参数 `TPeriod` 承载）与三处坐标（`spec`）。
 *
 * ## 为什么用工厂而非静态类
 *
 * 1. **`maxPages` / `count` 必须进入装饰器工厂参数**（类定义时求值）与
 *    `getNext` 闭包。这是"要几页发几次"的前提 —— CLAUDE.md §2.5 记录过一次
 *    事故：用「装饰器给硬上限 + 聚合层按入参裁剪」绕过，用户传 maxPages=1 时
 *    上游被实际打了 **20 次**，而输出的 pagesFetched 因裁剪过仍显示 1，
 *    **从结果完全看不出超发**。
 *
 * 2. **`data` 外层元数据不在 `list[]` 里**，而 `@Paginated` 累积的是扁平 item
 *    数组（executor 内 `accumulated = [...accumulated, ...pageResult]`，
 *    端点方法返回非数组会报 `pageResult is not iterable` —— 这是真机才暴露的）。
 *    故元数据由闭包变量在端点方法体内捕获，再由 aggregate 读取。
 *
 * ⚠️ 闭包在此安全：每次调用工厂都新建一个类与一组闭包，一次 execute() 只跑
 * 一个 Goal 实例，不存在并发共享。（这与"端点方法体不得用 this"是两回事 ——
 * 后者是因为 executor 内是裸调 `fn(validated, page)`，this 为 undefined。）
 */
export function createFinanceGoal<TPeriod extends RawPeriodBase>(
  spec: FinanceGoalSpec,
  params: FinanceGoalParams,
): BaseGoal<FinanceGoalResult<TPeriod>> {
  const { scope, name, path } = spec;
  const { count, maxPages } = params;

  /** 首页响应的 data 外层元数据 —— 由端点方法体填充 */
  let head: RawFinanceEnvelope<TPeriod>["data"] = null;
  let pagesFetched = 0;

  @Goal({
    id: scope,
    name,
    baseURL: STOCK_API_BASE,
    defaults: SHARED_GOAL_DEFAULTS,
  })
  class FinanceGoal extends BaseGoal<FinanceGoalResult<TPeriod>> {
    @Paginated<RawFinanceEnvelope<TPeriod>, TPeriod>({
      // 游标类翻页：pageSize 不参与请求构造，实际每页条数由 query 的 count 决定
      pageSize: count,
      maxPages,
      params: (ctx, _page, cursor) => {
        const p = ctx.params as FinanceGoalParams;
        return buildFinanceQuery(p.symbol, p.type, p.count, cursor);
      },
      cursor: {
        getNext: (response) => {
          // 未登录 / 业务错误在此抛出，不会被静默当成"翻到底了"
          const periods = unwrapFinanceEnvelope(response, scope);
          return nextFinanceCursor(periods, count);
        },
      },
    })
    @Endpoint(path, { method: "GET" })
    fetchPeriods(response: RawFinanceEnvelope<TPeriod>): TPeriod[] {
      // 端点方法体即该页的投影函数。
      // ⚠️ 必须返回**数组** —— executor 用 spread 累积（见上方说明）。
      const periods = unwrapFinanceEnvelope(response, scope);
      if (head === null) head = response?.data ?? null;
      pagesFetched += 1;
      return periods;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): FinanceGoalResult<TPeriod> {
      const accumulated = ctx.get<TPeriod[]>("fetchPeriods") ?? [];
      const p = ctx.params as FinanceGoalParams;

      // 游标 +1 已避免重复；再去重一层，防御上游边界行为变化
      const seen = new Set<number>();
      const periods: TPeriod[] = [];
      for (const period of accumulated) {
        if (seen.has(period.report_date)) continue;
        seen.add(period.report_date);
        periods.push(period);
      }

      return {
        // 入参回显 —— 上游响应不含这些，是 Goal 层唯一允许的"非上游数据"来源
        symbol: p.symbol,
        type: p.type,
        singleQuarter: isSingleQuarterType(p.type),
        quoteName: head?.quote_name ?? null,
        currency: head?.currency ?? null,
        currencyName: head?.currency_name ?? null,
        orgType: head?.org_type ?? null,
        lastReportName: head?.last_report_name ?? null,
        periods,
        pagesFetched,
        crawledAt: new Date().toISOString(),
      };
    }
  }

  return new FinanceGoal();
}
