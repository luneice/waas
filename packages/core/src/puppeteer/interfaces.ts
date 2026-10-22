import type { Page } from "puppeteer-core";
import type { SkillExecuteOptions } from "../skill/interfaces";
import type { GoalExecutor } from "../goal/executor";
import type { IBrowserSessionProvider } from "../browser/interfaces";
import type { IArtifactSink } from "../storage/interfaces";

// ============================================================================
// Puppeteer Skill 选项 & 依赖
// ============================================================================

/** Puppeteer Skill 通用执行选项 */
export interface BrowserSkillOptions extends SkillExecuteOptions {
  /** CDP 远程调试地址（如 http://127.0.0.1:4444） */
  browserURL?: string;
  /** 外部注入已有 Page（跳过浏览器连接和页面导航） */
  page?: Page;
  /** 目标站点（路由用，通常自动从 siteURL 提取） */
  site?: string;
  /** 路由必须标签 */
  requiredTags?: string[];
}

/** PuppeteerSkill 依赖 — 仅需浏览器会话 */
export interface PuppeteerSkillDeps {
  sessionProvider: IBrowserSessionProvider;
  /** 产物持久化策略（可选）— 提供后自动在 persist 阶段写入文件并生成 Artifact 清单 */
  artifactSink?: IArtifactSink;
  /** Goal 执行引擎（可选）— PuppeteerGoalSkill 收窄为 required */
  goalExecutor?: GoalExecutor;
}

/** PuppeteerGoalSkill 依赖 — 额外需要 Goal 执行引擎 */
export interface GoalSkillDeps extends PuppeteerSkillDeps {
  goalExecutor: GoalExecutor;
}

/** @deprecated 使用 GoalSkillDeps 代替 */
export type BrowserSkillDeps = GoalSkillDeps;
