<!-- spider-shared v1 · 由任一 spider skill 构建时携带安装，以最后安装为准 -->

# spider 通用 · 运行环境 / 错误处置 / 输出契约（始终生效）

## 1. Chrome 远程调试端口（浏览器链路 skill 适用）

> 适用：bili / xhs / dedao / eastmoney / rss（list-extract、page-extract、浏览器补全）。
> 不适用：polymarket / report 等纯 HTTP skill。

- 这类 skill 在一个真实 Chrome 页面内发请求（自动带 Cookie；需登录态的站点要求该会话已登录）。
- 默认端口 `http://127.0.0.1:4444`，可经 `BROWSER_URL` 覆盖。

### 1.1 Chrome 未启动时 · 由 AI 主动启动（自动判断安装位置）

端口连不上、判定 Chrome 尚未以远程调试模式启动时，**自动判断本机 Chrome 安装位置并主动拉起**（无需写进代码，AI 在终端临时执行即可）：

- **`--user-data-dir` 必须用绝对路径**指向用户主目录下的 `chrome`（macOS/Linux `$HOME/chrome`、Windows `%USERPROFILE%\chrome`），不要用相对路径，避免随 cwd 漂移而生成多个不同 Profile；该目录作为独立、可复用的调试 Profile（与日常浏览的默认 Profile 隔离，保留各站点登录态）。
- 端口 / 地址与默认值对齐：`--remote-debugging-port=4444 --remote-debugging-address=127.0.0.1`。
- 启动命令按 OS 自动选用 Chrome 可执行文件路径（找不到默认路径时，AI 自行探测实际安装位置）：

  ```bash
  # macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --remote-debugging-port=4444 --remote-debugging-address=127.0.0.1 --user-data-dir="$HOME/chrome"

  # Linux（可执行名常见 google-chrome / google-chrome-stable / chromium）
  google-chrome \
    --remote-debugging-port=4444 --remote-debugging-address=127.0.0.1 --user-data-dir="$HOME/chrome"

  # Windows（PowerShell；路径以实际安装为准）
  & "C:\Program Files\Google\Chrome\Application\chrome.exe" `
    --remote-debugging-port=4444 --remote-debugging-address=127.0.0.1 --user-data-dir="$env:USERPROFILE\chrome"
  ```

- 启动后等待端口就绪再重试原调用；若该会话此前未登录目标站点，按下面流程提示用户登录。

### 1.2 自动启动后仍不可用 / 需登录

- 自动拉起失败（找不到 Chrome、端口被占等）或站点未登录时：
  1. 立即停止后续调用；
  2. 用 `AskUserQuestion` 让用户确认：Chrome 是否已正常启动 / 是否已登录目标站点 / 端口是否一致；
  3. 确认后重试一次，仍失败则报告并退出。
- **不要代登录**（登录由用户在拉起的 Chrome 页面内手动完成）。

## 2. 风控 / 登录态熔断（通用流程）

遇到连续非预期的 `endpoint-http`，或响应/控制台出现风控、验证码、Cookie 失效迹象（各 skill 的具体触发词见其自身 rules）时：

1. **立即熔断**：停止后置 skill，禁止短周期自动退避重试，禁止并发叩接口。
2. **强制人机协作**：调用 `AskUserQuestion` 告警——「⚠️ 采集端疑似触发风控或登录态失效，请检查 `127.0.0.1:4444` 页面是否仍登录、是否需手动处理验证」。
3. 用户明确确认恢复后再继续，此前阻塞任务。

## 3. 统一错误码

`metadata.errorInfo.kind` 取值与通用处置：

<!-- BEGIN:ERROR-TABLE 由 scripts/gen-error-table.ts 从 packages/core/src/errors/kind-meta.ts 生成，勿手改 -->
| `kind` | 类别 | 可重试 | 触发 | 处置 |
|---|---|---|---|---|
| `browser-unavailable` | browser | ✅ | CDP 端点连不上 / Chrome 未以远程调试模式启动 | 确认 Chrome 已按运行前置启动后重试；自动拉起失败按 §1.2 人机协作 |
| `browser-acquire-timeout` | browser | ✅ | 池化获取 Page 超时（并发打满且无人释放） | 降并发后退避重试 |
| `navigation-failed` | browser | ✅ | page.goto 失败 | 退避（1/2/4s）重试；反复失败检查网络与站点可达性 |
| `not-logged-in` | auth | ❌ | 缺少有效登录态 | 提示用户在调试 Chrome 内登录目标站点，确认后重试 |
| `access-denied` | auth | ❌ | 已登录但无访问权限 | 换账号或放弃该目标；不要自动重试 |
| `risk-control` | auth | ❌ | 触发站点风控/反爬：验证码、滑块、412/-352、下载到 HTML 拦截页等 | 立即熔断：停止后续调用，按 §2 告警并等用户处理后恢复；禁止自动重试（会加剧封禁） |
| `missing-context` | params | ❌ | 必填参数缺失 | 查该 skill 文档参数表补齐 |
| `invalid-params` | params | ❌ | 参数取值非法 | 按错误信息修正取值 |
| `upstream-shape-changed` | upstream | ❌ | 响应结构与契约不符（接口演化/字段消失/类型漂移） | 报告维护者——平台改版需更新契约；重试无意义 |
| `endpoint-http` | upstream | ✅ | 上游非 2xx，或 HTTP 200 但业务信封软失败（resultCode 异常/偶发空壳） | 先按各 skill rules 特例处置（如 401→刷新凭据）；其余短退避重试 |
| `endpoint-timeout` | upstream | ✅ | 单次请求超时 | 退避（1/2/4s）重试 |
| `retry-exhausted` | upstream | ❌ | 框架内重试次数耗尽 | 检查浏览器登录态与网络后再试 |
| `hook-abort` | pipeline | ❌ | Hook 主动 abortPipeline(reason) | 读 reason 定位业务原因 |
| `pipeline-error` | pipeline | ❌ | Hook/Stage 内部异常（含未分类的实现缺陷） | 框架或实现缺陷，报告维护者 |
| `no-results` | business | ❌ | 查询无命中（可判定的空，非异常） | 明确告知该筛选下无公开数据；换关键词/确认 ID，不自动放宽筛选 |
| `unsupported` | business | ❌ | 当前 skill 不支持该参数组合/能力 | 换 skill 或调整参数组合 |
<!-- END:ERROR-TABLE -->

> 各 skill 的特例（xhs 401→重拉 sign、bili 53013 隐私墙≠错误等）见其自身 rules。

## 4. 输出信封

所有 skill 顶层返回：

```jsonc
{
  "success": true,
  "data": <结果>,
  "metadata": {
    "elapsed": 1234,          // ms（部分 skill 为 durationMs）
    "endpoint": "...",        // 上游 path（已脱敏）
    "errorInfo": { "kind": "...", "message": "...", "context": {} }  // 仅失败时
  }
}
```

多数业务 skill 的 `.data` 为 **AI-Ready 信封**：

```jsonc
{
  "meta":     { "skill": "...", "crawledAt": "...", /* 入参回显 + 派生汇总 */ },
  "insights": [ "中文要点 1", "中文要点 2" ],   // ★ 优先读
  "items":    [ /* 或 payload / content，业务明细 */ ]
}
```

**消费规则**：
- **优先读 `meta` + `insights`** 做摘要 / 决策 / 上下文压缩；明细在 `items[]` / `payload.*`。
- 翻页元数据：page 类看 `total`/`pagesFetched`/`returnedCount`；游标类看 `nextOffset`/`hasMore`。
- 落盘类副作用文件汇总在顶层 `artifacts`。
- 字段名 camelCase 强契约；各 skill 的 `.data` 形态差异见其自身 rules / references。

标准 jq 提取：

```bash
jq '.data.insights[]'                    result.json   # 中文要点
jq '.data.items[] | {title, link}'       result.json   # 列表明细
jq '.data.nextOffset, .data.hasMore'     result.json   # 游标翻页
jq '{success, error:.metadata.errorInfo}' result.json  # 状态
```

## 5. `--raw` 逃生开关

```bash
node ${CLAUDE_SKILL_DIR}/scripts/index.js <skill-id> '<json>' --raw
```

跳过整条投影管线，`.data` 为 100% 上游原文（PascalCase + 噪声）。**仅**在怀疑投影误删字段时排查用，不可用于生产消费。

## 6. 回写给用户的约束

- 数字 ID 类字段**保留原值**，不换算、不四舍五入。
- 统计口径只用上游 / `meta` 给出的含义，不自造词。
- 空结果（`items=[]`）明确告知「该筛选下无公开数据」，不假装有结果、不自动放宽筛选。
- 输出格式化好的 markdown；数据量大时用表格，字段易于人读（避免纯数字 ID / URL 占列，除非是核心信息）；建立视觉层次（核心结论醒目、细节弱化）。
- 条目很多时分批输出并标注「第 X/Y 批」，不因上下文空间静默丢弃已获取内容。
