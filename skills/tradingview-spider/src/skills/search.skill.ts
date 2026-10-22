/**
 * tv-search —— 标的检索
 *
 * 本包的入口 Skill：其它三个 Skill 的 `symbols` / `tickers` 入参都来自这里的
 * `items[].ticker`。Agent 不应自行拼写 ticker（§2.2「ID 严禁猜测」）。
 */

import {
  InvalidParamsError,
  type BaseGoal,
  type ProjectionPipeline,
  type SkillParamSchema,
} from "@spider/core";
import { TvSkillBase } from "@src/skills/tv-skill-base";
import {
  SEARCH_DEFAULT_LANG,
  SEARCH_DEFAULT_SORT_COUNTRY,
  SEARCH_TYPE_NAMES,
} from "@src/constants";
import { SymbolSearchGoal } from "@src/thrall/search";
import { projectSearchAiReady } from "@src/projections/search.ai-ready";
import { ID_NAMESPACES, nsTag } from "@src/projections/id-namespace";
import type { TvSearchResult } from "@src/types/search.types";
import type { TvSearchProjected } from "@src/types/projected.types";

export interface TvSearchParams {
  text?: string;
  searchType?: string;
  exchange?: string;
  lang?: string;
  sortByCountry?: string;
  start?: number;
  maxPages?: number;
  grouping?: boolean;
}

/** 与 thrall/search.ts 的 MAX_PAGES_HARD_LIMIT 对齐 */
const MAX_PAGES_LIMIT = 20;

export class TvSymbolSearchSkill extends TvSkillBase<
  TvSearchParams,
  TvSearchResult,
  TvSearchProjected
> {
  readonly id = "tv-search";
  readonly name = "标的检索";
  readonly description =
    "按关键词检索**全球市场任意标的**，产出 ticker 供下游 Skill 使用。" +
    "覆盖：各国股票（美/中/日/港/英/德/印/韩/加/澳/法/巴西等）、加密货币（现货/合约/稳定币）、" +
    "期货、期权、外汇、债券、各国央行利率与宏观指标、指数、基金、大宗商品、差价合约。" +
    "查利率/逆回购/CPI 等宏观指标传 searchType=economic 更精准。" +
    "这是本包的入口 Skill —— 其它 Skill 的标的入参都应来自这里的 items[].ticker，不要自行拼写。";

  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "text",
      type: "string",
      required: true,
      description:
        "检索关键词：标的代码、公司名或宏观指标英文名。" +
        "例：`US10Y`（美债收益率）、`AAPL`、`interest rate`（各国利率）、`reverse repo`（逆回购）、`SOFR`。" +
        "宏观指标建议用英文，中文命中率低。",
    },
    {
      name: "searchType",
      type: "string",
      required: false,
      description:
        `限定资产类别，已验证可用：${SEARCH_TYPE_NAMES.join(" / ")}。` +
        "economic=各国央行利率/CPI/逆回购等宏观指标，crypto=加密货币（返回 spot/swap/index），" +
        "cfd=差价合约（返回 commodity/index/forex）。" +
        "**留空 = 不限类别，可搜到全部资产**（含期权、大宗商品等）。" +
        "注意本参数与结果里的 `type` 是两套值域：option/spot/commodity 作为 searchType 会被上游拒绝，" +
        "但这些资产本身留空即可搜到（如 BTCUSDT 的 type 是 spot）。取值不做白名单拦截。",
    },
    {
      name: "exchange",
      type: "string",
      required: false,
      description:
        `${nsTag(ID_NAMESPACES.EXCHANGE)} 限定交易所/数据源前缀（如 NASDAQ / TVC / FRED / ECONOMICS），` +
        "取值来自本 Skill 输出的 items[].exchange。" +
        "**这不是 tv-scan 的 market 参数** —— 那个的取值是 global/china/bonds，两者集合完全不相交。",
    },
    {
      name: "lang",
      type: "string",
      required: false,
      default: SEARCH_DEFAULT_LANG,
      description: "结果中 description 字段的语言，默认 zh（中文名称）。",
    },
    {
      name: "sortByCountry",
      type: "string",
      required: false,
      default: SEARCH_DEFAULT_SORT_COUNTRY,
      description: "优先排序的国家代码（两位大写），默认 CN。",
    },
    {
      name: "start",
      type: "number",
      required: false,
      default: 0,
      description:
        "起始偏移，用于续取。上一次调用返回的 meta.nextStart 即为下次应传的值。",
    },
    {
      name: "maxPages",
      type: "number",
      required: false,
      default: 1,
      description:
        `连续翻页数，每页 50 条，上限 ${MAX_PAGES_LIMIT}。` +
        "上游返回的剩余数为 0 时会提前终止，不会空跑。",
    },
    {
      name: "grouping",
      type: "boolean",
      required: false,
      default: false,
      description:
        "是否合并同一公司在多个交易所的挂牌。开启后 items[].alsoListedOn 给出其它挂牌 ticker。",
    },
  ];

  protected normalizeParams(params: TvSearchParams): TvSearchParams {
    const text = typeof params.text === "string" ? params.text.trim() : "";
    if (!text) {
      throw new InvalidParamsError(
        "text 不能为空 —— 请给出标的代码、公司名或宏观指标英文名（如 interest rate）。",
        { scope: this.id },
      );
    }

    const maxPages = Math.min(
      Math.max(1, Math.floor(Number(params.maxPages ?? 1) || 1)),
      MAX_PAGES_LIMIT,
    );
    const start = Math.max(0, Math.floor(Number(params.start ?? 0) || 0));

    return {
      text,
      searchType: params.searchType?.trim() || null,
      exchange: params.exchange?.trim() || null,
      lang: params.lang?.trim() || SEARCH_DEFAULT_LANG,
      sortByCountry:
        params.sortByCountry?.trim() || SEARCH_DEFAULT_SORT_COUNTRY,
      start,
      maxPages,
      grouping: params.grouping ?? false,
    } as TvSearchParams;
  }

  protected createGoal(): BaseGoal<TvSearchResult> {
    return new SymbolSearchGoal();
  }

  protected get pipeline(): ProjectionPipeline<
    TvSearchParams,
    TvSearchResult,
    TvSearchResult,
    TvSearchProjected
  > {
    return {
      envelope: (data) => projectSearchAiReady(data),
    };
  }
}
