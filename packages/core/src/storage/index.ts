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
} from "./interfaces";
export { FileArtifactSink, type FileArtifactSinkOptions } from "./file-store";
export { MemoryArtifactSink } from "./memory-store";
export { FlatLayout, DateLayout, sanitizeSlug } from "./layouts";
export {
  DocumentArtifactSink,
  type WriteDocumentInput,
} from "./document-sink";
export {
  ContentStore,
  type ObjectRef,
  type ContentAsset,
  type ContentRecord,
} from "./content-store";
export {
  resolveStorageRoot,
  ensureGitignore,
  type ResolveStorageRootOptions,
} from "./resolve-root";
