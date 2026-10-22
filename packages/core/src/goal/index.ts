// Goal Layer — Barrel
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
} from "./interfaces";

export type { ResponseValidator, EndpointSchemaOptions } from "./schema";

export {
  Goal,
  Endpoint,
  Paginated,
  Expanded,
  Aggregate,
  getGoalMetadata,
  finalizeGoalMetadata,
  METADATA_KEY,
} from "./decorators";

export { BaseGoal } from "./base";
export { GoalContextImpl } from "./context";
export { GoalExecutor, createGoalExecutor } from "./executor";
export { Streamed, STREAMED_METADATA_KEY } from "./streamed";
export type { StreamedOptions, StreamDecode } from "./streamed";
export type { GoalExecutorOptions } from "./executor";
