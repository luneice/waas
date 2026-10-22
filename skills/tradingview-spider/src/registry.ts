/**
 * IoC 组装点 —— 本包唯一的能力全景图
 *
 * ┌─────────────────────┬──────────────────┬──────────────────────────────────────┐
 * │ Skill               │ 链路             │ 用途                                 │
 * ├─────────────────────┼──────────────────┼──────────────────────────────────────┤
 * │ tv-search           │ Goal（页内 fetch）│ 按关键词找标的，产出 ticker（入口）   │
 * │ tv-scan             │ Goal（页内 fetch）│ 一次请求取多标的的指定字段截面快照   │
 * │ tv-quote            │ WS（页内 socket） │ 多标的实时报价快照                   │
 * │ tv-history          │ WS（页内 socket） │ 历史 K 线序列（分辨率 + 时间范围）   │
 * │ tv-indicator-list   │ Goal（页内 fetch）│ 指标目录检索，产出 pineId（入口）    │
 * │ tv-indicator        │ Goal + WS 两段式  │ 指标数值序列（先编译再挂载）         │
 * └─────────────────────┴──────────────────┴──────────────────────────────────────┘
 *
 * 两个入口 Skill 各自产出下游必需的 ID：`tv-search → ticker`、
 * `tv-indicator-list → pineId`。tv-indicator 同时需要这两者。
 */

import {
  SkillRegistry,
  ChromeSessionProvider,
  createGoalExecutor,
  type GoalExecutor,
  type IBrowserSessionProvider,
} from "@spider/core";
import type { TvSkillDeps } from "@src/skills/tv-skill-base";
import { createPageWsTransport } from "@src/ws/transport";
import { TvSymbolSearchSkill } from "@src/skills/search.skill";
import { TvScannerScanSkill } from "@src/skills/scan.skill";
import { TvQuoteSnapshotSkill } from "@src/skills/quote.skill";
import { TvHistorySeriesSkill } from "@src/skills/history.skill";
import { TvIndicatorListSkill } from "@src/skills/indicator-list.skill";
import { TvIndicatorSkill } from "@src/skills/indicator.skill";
import type { TvWsSkillDeps } from "@src/skills/tv-ws-skill-base";

export interface RegistryDeps {
  sessionProvider: IBrowserSessionProvider;
  goalExecutor: GoalExecutor;
}

/**
 * 组装注册表。
 *
 * `deps?.x ?? new DefaultX()` 提供默认实现并允许测试注入。
 */
export function createDefaultRegistry(
  deps?: Partial<RegistryDeps>,
  browserURL?: string,
): SkillRegistry {
  const skillDeps: TvSkillDeps = {
    sessionProvider:
      deps?.sessionProvider ?? new ChromeSessionProvider({ browserURL }),
    goalExecutor: deps?.goalExecutor ?? createGoalExecutor(),
    wsTransportFactory: createPageWsTransport,
  };

  // WS 链路不走 Goal（无 HTTP 端点可声明），deps 形状更窄
  const wsDeps: TvWsSkillDeps = {
    sessionProvider: skillDeps.sessionProvider,
    wsTransportFactory: skillDeps.wsTransportFactory,
  };

  /**
   * tv-indicator 是**两段式**：WS 取数 + HTTP 编译，两者都要。
   * 因此在 WS 依赖上额外补 goalExecutor（框架把它声明为
   * `PuppeteerSkillDeps` 的可选依赖，正是为这类混合链路留的缝）。
   */
  const indicatorDeps: TvWsSkillDeps = {
    ...wsDeps,
    goalExecutor: skillDeps.goalExecutor,
  };

  return new SkillRegistry()
    .register(new TvSymbolSearchSkill(skillDeps))
    .register(new TvScannerScanSkill(skillDeps))
    .register(new TvQuoteSnapshotSkill(wsDeps))
    .register(new TvHistorySeriesSkill(wsDeps))
    .register(new TvIndicatorListSkill(skillDeps))
    .register(new TvIndicatorSkill(indicatorDeps));
}
