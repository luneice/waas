// Browser connection infrastructure
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
} from "./interfaces";

// Session provider (下层唯一入口)
export { ChromeSessionProvider } from "./provider";
export type { ChromeSessionProviderOptions } from "./provider";

// Connectors (策略实现)
export { CDPConnector } from "./cdp-connector";
export { PooledConnector } from "./pooled-connector";

// Pool & Router
export { BrowserPool } from "./pool";
export type { BrowserPoolOptions } from "./pool";
export { CompositeRouter } from "./router";
export { loadBrowserEndpoints } from "./config";
