#!/usr/bin/env node
/**
 * HAR 决策提取器 —— 把「新增 spider 包前必须回答的 5 个问题」从抓包里机械提取出来。
 *
 * 存在的理由：这 5 个答案此前全靠人凭印象判断，而错判的代价是造完一整层才被发现。
 * 其中问题 2、3 各自对应一次真实事故（CORS 预检被拒 / 凭证被拒），都是**只在真机
 * 暴露、单测抓不到**的那类。
 *
 * 用法：node .claude/scripts/har-decide.mjs <path-to.har> [--json]
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
const asJson = process.argv.includes("--json");
if (!file) {
  console.error("用法: node .claude/scripts/har-decide.mjs <path-to.har> [--json]");
  process.exit(1);
}

const har = JSON.parse(readFileSync(file, "utf8"));
const entries = har?.log?.entries ?? [];

/** 静态资源 / 埋点 / 广告：与业务无关，全部剔除 */
const NOISE = /(\.(js|css|png|jpe?g|gif|svg|woff2?|ttf|ico|mp4|webp)(\?|$))|google|doubleclick|analytics|sentry|snowplow|hotjar|gtag|facebook|beacon|telemetry/i;

const header = (list, name) =>
  (list ?? []).find((h) => h.name?.toLowerCase() === name)?.value ?? null;

const api = entries.filter((e) => {
  const u = e.request?.url ?? "";
  if (!/^https?:/i.test(u)) return false;
  if (NOISE.test(u)) return false;
  const ct = header(e.response?.headers, "content-type") ?? "";
  // 保留 JSON / 流式；HTML 通常是页面本身
  return /json|event-stream|x-ndjson/i.test(ct) || e.request?.method !== "GET";
});

const host = (u) => { try { return new URL(u).host; } catch { return "?"; } };
const path = (u) => { try { return new URL(u).pathname; } catch { return u; } };

// ── ① 登录态 ─────────────────────────────────────────────
const withCookie = api.filter((e) => header(e.request?.headers, "cookie"));
const withAuth = api.filter((e) => header(e.request?.headers, "authorization"));
const q1 = {
  需要登录态: withCookie.length > 0 || withAuth.length > 0,
  带Cookie的请求数: withCookie.length,
  带Authorization的请求数: withAuth.length,
  判据: "有 Cookie/Authorization → Goal 模式（PuppeteerGoalSkill）；否则考虑纯 HTTP",
};

// ── ② CORS：逐 host 看 allow-credentials（本次踩过）──────────
const byHost = new Map();
for (const e of api) {
  const h = host(e.request.url);
  if (!byHost.has(h)) byHost.set(h, { host: h, count: 0, allowCred: null, allowHeaders: null, acao: null });
  const rec = byHost.get(h);
  rec.count++;
  rec.allowCred ??= header(e.response?.headers, "access-control-allow-credentials");
  rec.allowHeaders ??= header(e.response?.headers, "access-control-allow-headers");
  rec.acao ??= header(e.response?.headers, "access-control-allow-origin");
}
const q2 = [...byHost.values()].map((r) => ({
  host: r.host,
  请求数: r.count,
  "allow-credentials": r.allowCred ?? "(无)",
  建议: r.allowCred === "true" ? 'credentials: "include"（默认，可不写）'
      : r.acao === "*" ? 'credentials: "omit" —— ACAO=* 与凭证互斥，带凭证会被浏览器拒绝'
      : 'credentials: "omit" —— 响应头无 allow-credentials，带凭证会被拒绝',
  "allow-headers": r.allowHeaders ?? "(无)",
}));

// ── ③ Content-Type：决定 body 传 string 还是 object ──────────
const ctCount = new Map();
for (const e of api) {
  if (!["POST", "PUT", "PATCH"].includes(e.request?.method)) continue;
  const ct = (header(e.request?.headers, "content-type") ?? "(无)").split(";")[0].trim();
  const h = host(e.request.url);
  const key = `${h} ${e.request.method} ${ct}`;
  ctCount.set(key, (ctCount.get(key) ?? 0) + 1);
}
const q3 = [...ctCount.entries()].map(([k, n]) => {
  const ct = k.split(" ").pop();
  return {
    "host/方法/Content-Type": k,
    次数: n,
    建议: ct === "application/json"
      ? "body 返回 object（core 会 JSON 序列化并设 application/json）"
      : ct === "(无)"
      ? "无 body 或 GET"
      : `body 返回 **string** + 显式 headers['Content-Type']='${ct}' —— core 对 string body 保留调用方的 Content-Type`,
  };
});

// ── ④ 流式 / 长连接 ──────────────────────────────────────
const ws = entries.filter((e) => /^wss?:/i.test(e.request?.url ?? "") || Array.isArray(e._webSocketMessages));
const sse = api.filter((e) => /event-stream|x-ndjson/i.test(header(e.response?.headers, "content-type") ?? ""));
const q4 = {
  有WebSocket: ws.length > 0,
  WS连接数: ws.length,
  WS帧总数: ws.reduce((s, e) => s + (e._webSocketMessages?.length ?? 0), 0),
  有SSE或NDJSON: sse.length > 0,
  建议: ws.length || sse.length
    ? "涉及推送流：SSE/NDJSON 用 @Endpoint + @Streamed；WebSocket 无 HTTP 端点可声明，应跳出 Goal 链直接继承 PuppeteerSkill（见 CLAUDE.md §3.1）"
    : "纯请求-响应，@Endpoint / @Paginated / @Expanded 足够",
};

// ── ⑤ 上游枚举（只是本次抓包所见，不是全集）────────────────
const enums = new Map();
for (const e of api) {
  let u; try { u = new URL(e.request.url); } catch { continue; }
  for (const [k, v] of u.searchParams) {
    if (v.length > 40 || /^\d{10,}$/.test(v)) continue; // 跳过 token/时间戳
    if (!enums.has(k)) enums.set(k, new Set());
    enums.get(k).add(v);
  }
}
const q5 = [...enums.entries()]
  .filter(([, vs]) => vs.size > 1 && vs.size <= 12)
  .map(([k, vs]) => ({ 参数: k, "本次所见取值": [...vs] }))
  .slice(0, 15);

const result = {
  概览: { HAR条目总数: entries.length, 业务接口数: api.length, 涉及host数: byHost.size },
  "① 是否需要登录态": q1,
  "② 各 host 的 CORS 策略（决定 credentials）": q2,
  "③ 请求体 Content-Type（决定 body 传 string 还是 object）": q3,
  "④ 是否有流式/长连接": q4,
  "⑤ 上游枚举（⚠️ 仅本次抓包所见，不是全集，勿写成白名单拦截）": q5,
  接口清单: [...new Set(api.map((e) => `${e.request.method} ${host(e.request.url)}${path(e.request.url)}`))].slice(0, 40),
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(JSON.stringify(result, null, 2));
}
