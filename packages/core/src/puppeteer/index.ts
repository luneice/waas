// Re-export 聚合入口 — 保持对子模块消费者的平坦导入路径。

export { PageContext } from "./context";
export type { SlotKey } from "./slots";
export {
  defineSlot,
  CapturedMediaSlot,
  ArtifactsSlot,
  ArtifactPrefixSlot,
  ArtifactLegendsSlot,
} from "./slots";
export type { CapturedEntry } from "./captured-entry";

export type {
  IPageHook,
  HookFn,
  HookOutcome,
  HookSignal,
  ActivationPredicate,
} from "./hooks";
export {
  HookAbortError,
  SKIP_STAGE,
  SKIP_PIPELINE,
  abortPipeline,
  whenParam,
  whenParamNot,
  whenSlot,
  not,
  allOf,
  anyOf,
} from "./hooks";

export {
  LifecycleStage,
  PageLifecycle,
  PipelineHalt,
  SetupStage,
  ReadyStage,
  InteractStage,
  ExtractStage,
  TransformStage,
  PersistStage,
  TeardownStage,
  defaultLifecycle,
  teardownStage,
  DATA_PIPELINE_STAGES,
} from "./lifecycle";

export { PageInterceptor } from "./interceptor";
export type { InterceptMode, InterceptorOptions } from "./interceptor";

export { ResponseInterceptor } from "./response-interceptor";
export type {
  ResponseInterceptorOptions,
  ResponseMatcher,
  ResponseParse,
} from "./response-interceptor";

export {
  CaptureResponse,
  CaptureMedia,
  BlockResource,
  Viewport,
  UserAgent,
  Screenshot,
  Setup,
  Ready,
  Interact,
  Extract,
  Transform,
  Persist,
  Teardown,
  getClassHooks,
  getMethodHooks,
  getScreenshotOptions,
  buildSelfHook,
  pushClassHook,
} from "./decorators";
export type {
  StageName,
  CaptureResponseOptions,
  CaptureMediaOptions,
  BlockResourceOptions,
  ScreenshotOptions,
} from "./decorators";

export type {
  BrowserSkillOptions,
  PuppeteerSkillDeps,
  GoalSkillDeps,
} from "./interfaces";

export { PuppeteerSkill } from "./skill";
export { PuppeteerGoalSkill } from "./goal-skill";

export { ArtifactPersistHook } from "./artifact-persist";
export type { ArtifactPersistOptions } from "./artifact-persist";

// v2 新增
export {
  StorageReset,
  StorageResetHook,
  StorageResetReportSlot,
} from "./storage-reset";
export type { StorageResetOptions } from "./storage-reset";

export {
  RetryPolicy,
  RetryNavigation,
  RetryStage,
  getNavigationRetry,
  getStageRetries,
} from "./retry";
export type {
  RetryPolicyOptions,
  RetryRunContext,
  RetryBackoff,
  RetryStageEntry,
} from "./retry";
