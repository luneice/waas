import type {
  BrowserEndpoint,
  EndpointHealth,
  IBrowserRouter,
  RouteConstraints,
} from "./interfaces";

/**
 * 组合路由策略 — Site Affinity → Least Connections 兜底
 *
 * 路由逻辑：
 * 1. 过滤出健康（或状态未知）的 endpoint
 * 2. 如有 site/requiredTags 约束：精确匹配 tags
 * 3. 如有 preferredTags：软匹配打分
 * 4. 在候选集中选 activePages 最少的（Least Connections）
 * 5. 若约束匹配不到，fallback 到所有健康节点的 Least Connections
 */
export class CompositeRouter implements IBrowserRouter {
  route(
    constraints: RouteConstraints,
    endpoints: BrowserEndpoint[],
    health: Map<string, EndpointHealth>,
  ): BrowserEndpoint | null {
    // Step 1: 健康过滤
    const healthy = endpoints.filter((ep) => {
      const h = health.get(ep.id);
      // "unknown" = 尚未检查过，允许尝试
      return !h || h.status !== "unhealthy";
    });
    if (healthy.length === 0) return null;

    // Step 2: 按约束筛选
    let candidates = this.matchConstraints(healthy, constraints);

    // Step 3: 约束匹配失败 — fallback 到全部健康节点
    if (candidates.length === 0) {
      candidates = healthy;
    }

    // Step 4: 并发控制 — 排除已满的
    candidates = candidates.filter((ep) => {
      const maxConc = ep.maxConcurrency ?? 10;
      if (maxConc <= 0) return true; // 无限
      const h = health.get(ep.id);
      return !h || h.activePages < maxConc;
    });
    if (candidates.length === 0) {
      // 全满了 — 选活跃页面最少的（会排队等待）
      candidates = healthy;
    }

    // Step 5: Least Connections
    return this.leastConnections(candidates, health);
  }

  private matchConstraints(
    endpoints: BrowserEndpoint[],
    constraints: RouteConstraints,
  ): BrowserEndpoint[] {
    const { site, requiredTags, preferredTags } = constraints;
    if (!site && !requiredTags?.length && !preferredTags?.length) {
      return endpoints;
    }

    // Hard constraints: site + requiredTags
    let filtered = endpoints;
    if (site) {
      const siteMatched = filtered.filter((ep) =>
        ep.tags?.some(
          (t) => t === site || site.endsWith(`.${t}`) || t.endsWith(`.${site}`),
        ),
      );
      if (siteMatched.length > 0) filtered = siteMatched;
    }
    if (requiredTags?.length) {
      filtered = filtered.filter((ep) =>
        requiredTags.every((tag) => ep.tags?.includes(tag)),
      );
    }

    // Soft constraints: preferredTags (rank within filtered set)
    if (preferredTags?.length && filtered.length > 1) {
      const scored = filtered
        .map((ep) => ({
          ep,
          score: preferredTags.filter((t) => ep.tags?.includes(t)).length,
        }))
        .sort((a, b) => b.score - a.score);
      const maxScore = scored[0].score;
      if (maxScore > 0) {
        filtered = scored.filter((s) => s.score === maxScore).map((s) => s.ep);
      }
    }

    return filtered;
  }

  private leastConnections(
    endpoints: BrowserEndpoint[],
    health: Map<string, EndpointHealth>,
  ): BrowserEndpoint | null {
    if (endpoints.length === 0) return null;
    let best = endpoints[0];
    let bestActive = health.get(best.id)?.activePages ?? 0;
    for (let i = 1; i < endpoints.length; i++) {
      const active = health.get(endpoints[i].id)?.activePages ?? 0;
      if (active < bestActive) {
        best = endpoints[i];
        bestActive = active;
      }
    }
    return best;
  }
}
