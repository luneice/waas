/**
 * 注册表工厂 —— IoC 组装点
 *
 * ## 能力全景
 *
 * | 模块 | Skill 数 | 上游端点 | 页面路径 |
 * |------|---------|---------|---------|
 * | 财务报表（A 组） | 4 | `stock.xueqiu.com/v5/stock/finance/cn/*.json` | `/snowman/S/{symbol}/detail` |
 *
 * 已实现：
 *   - `xueqiu-income`    利润表（43 字段，期间累计口径）
 *   - `xueqiu-balance`   资产负债表（90 字段，时点存量口径）
 *   - `xueqiu-cashflow`  现金流量表（41 字段，期间累计口径）
 *   - `xueqiu-indicator` 主要财务指标（38 字段，衍生指标，⚠️ 单位不统一）
 *
 * | 股权与公司运作（B 组） | 6 | `stock.xueqiu.com/v5/stock/f10/cn/*.json` | 同上 |
 *
 * B 组已实现（page/size 类）：
 *   - `xueqiu-bonus`              分红 + 增发 + 配股
 *   - `xueqiu-holders-num`        股东人数与筹码结构
 *   - `xueqiu-restricted-release` 限售解禁
 *   - `xueqiu-insider-trades`     高管增减持
 *
 * B 组已实现（日期索引类，@Expanded 按期展开）：
 *   - `xueqiu-top-holders`  十大股东 / 十大流通股东（circulating 切换口径）
 *   - `xueqiu-fund-holding` 基金持股明细
 *
 * 跨表使用注意：
 *   - income + cashflow → 盈利质量（经营现金流 / 净利润）
 *   - indicator 与 balance 有 2 个同名字段口径冲突（asset_liab_ratio 差 100 倍、
 *     capital_reserve 一个是每股一个是总额），跨表 join 前须对齐
 *
 * ## 运行前置
 *
 * 需要一个已登录雪球、并开启远程调试的 Chrome（默认 `127.0.0.1:4444`）。
 * 上游缺少登录态时返回 `400016`，本包映射为 `not-logged-in`。
 */
import {
  SkillRegistry,
  createGoalExecutor,
  ChromeSessionProvider,
  FileArtifactSink,
  type GoalSkillDeps,
} from "@spider/core";
import { IncomeStatementSkill } from "@src/skills/finance/income.skill";
import { BalanceSheetSkill } from "@src/skills/finance/balance.skill";
import { CashFlowSkill } from "@src/skills/finance/cashflow.skill";
import { FinancialIndicatorSkill } from "@src/skills/finance/indicator.skill";
import {
  BonusSkill,
  HoldersNumSkill,
  RestrictedReleaseSkill,
  InsiderTradeSkill,
} from "@src/skills/equity/page-skills";
import {
  TopHoldersSkill,
  FundHoldingSkill,
} from "@src/skills/equity/time-skills";

export const createDefaultRegistry = (
  deps?: Partial<GoalSkillDeps>,
  browserURL?: string,
  outputDir?: string,
): SkillRegistry => {
  const baseDir = outputDir ?? process.cwd();
  const resolved: GoalSkillDeps = {
    sessionProvider:
      deps?.sessionProvider ?? new ChromeSessionProvider({ browserURL }),
    goalExecutor: deps?.goalExecutor ?? createGoalExecutor(),
    artifactSink: deps?.artifactSink ?? new FileArtifactSink(baseDir),
  };

  return new SkillRegistry()
    .register(new IncomeStatementSkill(resolved))
    .register(new BalanceSheetSkill(resolved))
    .register(new CashFlowSkill(resolved))
    .register(new FinancialIndicatorSkill(resolved))
    .register(new BonusSkill(resolved))
    .register(new HoldersNumSkill(resolved))
    .register(new RestrictedReleaseSkill(resolved))
    .register(new InsiderTradeSkill(resolved))
    .register(new TopHoldersSkill(resolved))
    .register(new FundHoldingSkill(resolved));
};
