import "reflect-metadata";

// ============================================================================
// 顶层入口 — 按层级聚合导出
// ============================================================================

// Layer 0 — 错误体系（贯穿全栈，最先导出）
export * from "./errors";

// Layer 0 — 可观测性（仅类型 / Sink / Bus；运行时服务看 ./runtime）
export * from "./observability";

// Layer 0 — 运行时上下文（RuntimeContext / Tracer / EventEmitter）
export * from "./runtime";

// Layer 1 — Goal 引擎
export type {
  GoalOptions,
  GoalDefaults,
  EndpointOptions,
  PaginatedOptions,
  ExpandedOptions,
  RetryOptions,
  GoalContext,
  HttpMethod,
  EndpointMetadata,
  GoalMetadataStore,
} from "./goal/interfaces";
export {
  Goal,
  Endpoint,
  Paginated,
  Expanded,
  Aggregate,
  getGoalMetadata,
  finalizeGoalMetadata,
  METADATA_KEY,
} from "./goal/decorators";
export { BaseGoal } from "./goal/base";
export { GoalContextImpl } from "./goal/context";
export { GoalExecutor, createGoalExecutor } from "./goal/executor";
export { Streamed, STREAMED_METADATA_KEY } from "./goal/streamed";
export type { StreamedOptions, StreamDecode } from "./goal/streamed";
export type { GoalExecutorOptions } from "./goal/executor";
export type { ResponseValidator, EndpointSchemaOptions } from "./goal/schema";

// 流式数据源 — 无界事件流 → 有界结果（SSE / WebSocket / NDJSON 共用）
export { createSseDecoder } from "./stream/sse-decoder";
export type { SseEvent } from "./stream/sse-decoder";
export { runStream, isTruncated } from "./stream/reducer";
export type {
  StreamReducerOptions,
  StreamRunResult,
  StreamSource,
  StreamStopReason,
} from "./stream/reducer";

// Layer 2 — Skill 基础设施
export type {
  ISkill,
  SkillParamSchema,
  SkillExecuteOptions,
  SkillResult,
  SkillResultSuccess,
  SkillResultFailure,
  SkillResultMetadata,
  SkillWarning,
  SkillFailureKind,
} from "./skill/interfaces";
export { formatError } from "./skill/interfaces";
export { BaseSkill } from "./skill/base";
export { SkillRegistry } from "./skill/registry";
export type { SkillInfo } from "./skill/registry";

// Layer 3 — 浏览器连接
export type {
  BrowserEndpoint,
  EndpointStatus,
  EndpointHealth,
  RouteConstraints,
  BrowserAcquireOptions,
  BrowserLease,
  IBrowserConnector,
  IBrowserPool,
  IBrowserRouter,
  PageSession,
  IBrowserSessionProvider,
} from "./browser/interfaces";
export { ChromeSessionProvider } from "./browser/provider";
export type { ChromeSessionProviderOptions } from "./browser/provider";
export { CDPConnector } from "./browser/cdp-connector";
export { PooledConnector } from "./browser/pooled-connector";
export { BrowserPool } from "./browser/pool";
export type { BrowserPoolOptions } from "./browser/pool";
export { CompositeRouter } from "./browser/router";
export { loadBrowserEndpoints } from "./browser/config";

// Layer 4 — Storage / Artifact
export type {
  IArtifactSink,
  Artifact,
  ArtifactMeta,
  ArtifactConflictPolicy,
  DocumentProvenance,
  LayoutStrategy,
  LayoutRequest,
  SidecarStrategy,
  SidecarContext,
  SidecarPlan,
} from "./storage/interfaces";
export {
  FileArtifactSink,
  type FileArtifactSinkOptions,
} from "./storage/file-store";
export { MemoryArtifactSink } from "./storage/memory-store";
export { FlatLayout, DateLayout, sanitizeSlug } from "./storage/layouts";
export {
  DocumentArtifactSink,
  type WriteDocumentInput,
} from "./storage/document-sink";
export {
  ContentStore,
  type ObjectRef,
  type ContentAsset,
  type ContentRecord,
} from "./storage/content-store";
export {
  resolveStorageRoot,
  ensureGitignore,
  type ResolveStorageRootOptions,
} from "./storage/resolve-root";

// Layer 5 — Puppeteer Skill 体系
export { PageContext } from "./puppeteer/context";
export type { SlotKey } from "./puppeteer/slots";
export {
  defineSlot,
  CapturedMediaSlot,
  ArtifactsSlot,
  ArtifactPrefixSlot,
  ArtifactLegendsSlot,
} from "./puppeteer/slots";
export type { CapturedEntry } from "./puppeteer/captured-entry";
export type {
  IPageHook,
  HookFn,
  HookOutcome,
  HookSignal,
  ActivationPredicate,
} from "./puppeteer/hooks";
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
} from "./puppeteer/hooks";
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
} from "./puppeteer/lifecycle";
export { PageInterceptor } from "./puppeteer/interceptor";
export type {
  InterceptMode,
  InterceptorOptions,
} from "./puppeteer/interceptor";
export { ResponseInterceptor } from "./puppeteer/response-interceptor";
export type {
  ResponseInterceptorOptions,
  ResponseMatcher,
  ResponseParse,
} from "./puppeteer/response-interceptor";
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
} from "./puppeteer/decorators";
export type {
  StageName,
  CaptureResponseOptions,
  CaptureMediaOptions,
  BlockResourceOptions,
  ScreenshotOptions,
} from "./puppeteer/decorators";
export type {
  BrowserSkillOptions,
  PuppeteerSkillDeps,
  GoalSkillDeps,
} from "./puppeteer/interfaces";
export { PuppeteerSkill } from "./puppeteer/skill";
export { PuppeteerGoalSkill } from "./puppeteer/goal-skill";
export {
  type ProjectionContext,
  type ProjectionPipeline,
  runProjectionPipeline,
} from "./puppeteer/projection";
export { ArtifactPersistHook } from "./puppeteer/artifact-persist";
export type { ArtifactPersistOptions } from "./puppeteer/artifact-persist";

// Layer 5+ — 安全 / 反爬扩展
export {
  StorageReset,
  StorageResetHook,
  StorageResetReportSlot,
} from "./puppeteer/storage-reset";
export type { StorageResetOptions } from "./puppeteer/storage-reset";

// Layer 5+ — 重试
export {
  RetryPolicy,
  RetryNavigation,
  RetryStage,
  getNavigationRetry,
  getStageRetries,
} from "./puppeteer/retry";
export type {
  RetryPolicyOptions,
  RetryBackoff,
  RetryStageEntry,
} from "./puppeteer/retry";

// Layer 6 — CLI
export { runCLI } from "./cli";
export type { CLIOptions } from "./cli";

// Layer 6 — License（签发/校验，纯离线）
export * from "./license";

// Layer 7 — 测试工具（命名空间导出）
export * as testing from "./testing";
