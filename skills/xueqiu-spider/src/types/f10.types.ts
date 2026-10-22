/**
 * B 组 · 股权与公司运作 类型定义（f10/cn/**）
 *
 * 与 A 组（财务报表）的根本差异：
 *   - 数值是**标量**，不是 `[值, 同比]` 二元组
 *   - `data` 形态各端点不同（`items` / `fund_items` / 多块并列）
 *
 * 字段语义均由真实数据勾稽验证，见 docs/api/README.md §9–§14。
 */

// ============================================================================
// ① 分红 / 增发 / 配股（bonus.json）
// ============================================================================

/** 单条分红记录 */
export interface RawBonusItem {
  /**
   * 分红所属期。
   * ⚠️ **两种格式并存**：报告期（`2025年报`）与日期（`2024-12-11`，特别分红）。
   * 按报告期与三张报表 join 时，日期格式的记录会漏配。
   */
  dividend_year: string;
  /**
   * 🔴 **分配方案说明 —— 分红金额的唯一来源**。
   * 上游不提供结构化金额字段，只能从这个中文串解析（见 projections/bonus-plan.ts）。
   */
  plan_explain: string;
  /** 股权登记日（毫秒） */
  equity_date: number | null;
  /** 除权除息日（毫秒） */
  ex_dividend_date: number | null;
  /** A 股除权除息日（毫秒） */
  ashare_ex_dividend_date: number | null;
  /** 派息日（毫秒） */
  dividend_date: number | null;
  /**
   * 取消分红日（毫秒）。⚠️ 上游拼写 `cancle`（应为 cancel），**原样保留**。
   * 非 null 表示该次分红**已被取消**，算分红总额时须排除。
   */
  cancle_dividend_date: number | null;
  [key: string]: unknown;
}

/** 单条增发记录 */
export interface RawAdditionItem {
  /** 实际发行数量（股）。⚠️ 带浮点噪声（109756097.00000001） */
  actual_issue_vol: number | null;
  /** 实际发行价（元/股） */
  actual_issue_price: number | null;
  /** 实际募集资金**净额**（元，已扣发行费用） */
  actual_rc_net_amt: number | null;
  /** 增发股份上市日（毫秒） */
  listing_ad: number | null;
  [key: string]: unknown;
}

/** bonus 端点的非分页附加数据（每页原样重复返回，只取一次） */
export interface BonusExtra {
  addtions: RawAdditionItem[];
  /** 配股。本样本为空数组，字段结构**未验证**，按 unknown 透传 */
  allots: unknown[];
}

// ============================================================================
// ② 十大股东 / 十大流通股东（top_holders.json）
// ============================================================================

/** 前十大股东项 */
export interface RawHolderItem {
  holder_name: string;
  /** 持股数量（股） */
  held_num: number | null;
  /** 持股占比（**百分数**，22.04 = 22.04%） */
  held_ratio: number | null;
  /**
   * 持股**数量**的环比变动（**百分数**）。
   * ⚠️ 不是持股**占比**的变动率（已验证：数量变动 14.0% 匹配、占比变动 14.81% 不匹配）。
   * ⚠️ `0.0` 表示持股未变，不是「无数据」。
   */
  chg: number | null;
  [key: string]: unknown;
}

/**
 * 退出前十的股东。
 *
 * ⚠️ **字段集与 RawHolderItem 不同，不能继承**（已全量核实 66 条）：
 * 没有 `chg`，但多了 `holder_rank`。继承会凭空多出上游不返回的字段。
 */
export interface RawQuitHolderItem {
  holder_name: string;
  held_num: number | null;
  held_ratio: number | null;
  /** 退出前的排名 —— items[] 中没有此字段 */
  holder_rank: number | null;
  [key: string]: unknown;
}

/** 十大股东合计（已验证与 items 之和精确吻合） */
export interface RawHolderTotal {
  held_num: number | null;
  /** 十大合计持股比例（百分数）—— 即**股权集中度** */
  held_ratio: number | null;
  chg: number | null;
  [key: string]: unknown;
}

// ============================================================================
// ③ 股东人数（holders.json）
// ============================================================================

/**
 * 单期股东人数与筹码结构。
 *
 * **两组勾稽已验证**：
 *   per_amount = per_float × price
 *   ashare_holder + hshare_holder = holder_num
 */
export interface RawHoldersNumItem {
  /** 报告期（毫秒）—— **跨页去重的业务主键** */
  timestamp: number;
  /** 股东总户数 */
  holder_num: number | null;
  ashare_holder: number | null;
  hshare_holder: number | null;
  /** B 股股东户数（无 B 股时为 null） */
  bshare_holder: number | null;
  /** 股东户数的**环比**变动（百分数，已验证四期反算吻合） */
  chg: number | null;
  /** 户均持流通股（股） */
  per_float: number | null;
  per_float_chg: number | null;
  /** 户均持股市值（元）= per_float × price */
  per_amount: number | null;
  /**
   * 该报告期股价（元）。
   * 🔴 **不能替代行情源做估值** —— 只在披露日有值，且未说明是收盘价还是均价。
   */
  price: number | null;
  /** 前十大股东合计持股比例（百分数） */
  top_holder_ratio: number | null;
  /** 前十大**流通**股东合计持股比例（百分数） */
  top_float_holder_ratio: number | null;
  [key: string]: unknown;
}

// ============================================================================
// ④ 基金持股（org_holding/detail.json）
// ============================================================================

/** 单只基金的持股 */
export interface RawFundHoldingItem {
  /** 机构或基金名称。⚠️ 值为 `全部合计` 时是**汇总行**，不是一只基金 */
  org_name_or_fund_name: string;
  /** 持股数量（股） */
  held_num: number | null;
  /** 占**流通股**比例（百分数）。⚠️ 分母是流通股，不是总股本 */
  to_float_shares_ratio: number | null;
  [key: string]: unknown;
}

// ============================================================================
// ⑤ 限售解禁（shareschg.json）
// ============================================================================

export interface RawRestrictItem {
  holder_name: string;
  /** 可流通日（解禁日，毫秒） */
  floatable_time: number | null;
  /** 解禁数量（股）。⚠️ 带浮点噪声 */
  floatable_shares_num: number | null;
  /**
   * 解禁股份类型。本样本只出现 `定向增发机构配售股份`，
   * A 股实际还有多种，**按开放字符串处理，不做枚举映射**。
   */
  float_shares_type: string;
  [key: string]: unknown;
}

// ============================================================================
// ⑥ 高管增减持（skholderchg.json）
// ============================================================================

export interface RawSkHolderChgItem {
  symbol: string;
  name: string;
  /** 股份变动人（实际买卖的人） */
  share_changer_name: string;
  /** 关联高管。变动人若是高管亲属，此处是高管本人 */
  manage_name: string;
  /** 变动人与高管的关系。本样本全为 `本人` */
  rr_of_chgr_and_manage: string;
  /** 职务 */
  duty: string;
  /** 变动日期（毫秒） */
  chg_date: number | null;
  /** 变动股数。🔴 **负数=减持，正数=增持** */
  chg_shares_num: number | null;
  /** 成交均价（元/股） */
  trans_avg_price: number | null;
  /** **变动后**持股余额（股）。otd = of the day */
  daily_shares_balance_otd: number | null;
  [key: string]: unknown;
}
