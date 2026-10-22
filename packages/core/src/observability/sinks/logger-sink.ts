// ============================================================================
// LoggerSink — legacy adapter; inert unless a logger is explicitly injected.
// ============================================================================

import type { ObsSink } from "../bus";
import type { ObsEvent } from "../events";
import { noopLogger, type ILogger } from "../logger";

export interface LoggerSinkOptions {
  logger?: ILogger;
}

export class LoggerSink implements ObsSink {
  readonly name = "logger";
  private readonly logger: ILogger;

  constructor(opts: LoggerSinkOptions = {}) {
    this.logger = opts.logger ?? noopLogger;
  }

  write(event: ObsEvent): void {
    const { kind, traceId, spanId, ts, ...rest } = event;
    void ts;
    this.logger.debug(kind, { traceId, spanId, ...rest });
  }
}
