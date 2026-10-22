---
description: 从 HAR 抓包新建一个 spider skill 包：先做 5 项决策（登录态/CORS/Content-Type/流式/枚举），再生成可运行骨架。用户说「新增 xxx-spider」「加一个爬虫包」时使用。
argument-hint: <包名，如 foo-spider> <HAR 文件路径>
disable-model-invocation: true
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# 新增 spider 包

包名：`$0`　HAR：`$1`

> 注：Claude Code 的位置参数 **`$0` 是第一个、`$1` 是第二个**（与 shell 直觉相反）。

> **这个命令存在的理由**：过去每次新增包，都会在实现阶段凭惯性造轮子（手写 HTTP 层、
> 自建 RAII、自写退避循环），被纠正后再回头深入调研其它包的实现——而这些答案
> **CLAUDE.md 里本来就写着**。问题不是"不知道"，是"知道了没照做"：正确路径的启动
> 成本（要先搞清装饰器语义）高于错误路径（手写 fetch 立刻会写），惯性总流向后者。
>
> 所以本命令**不是文档**，是带强制顺序的执行脚本：先把决策显式化，再把骨架生成出来，
> 让仿写比新写更省力。

## 强制顺序（不得跳步）

### 第 0 步 · 先看清框架已有什么

**在写任何代码前**，确认这些能力**已经存在**，不要自建：

| 你可能想写的 | 框架已有 | 位置 |
|---|---|---|
| HTTP 请求层 / `fetch` 封装 | `@Endpoint` + `GoalExecutor` | `goal/` |
| 翻页循环 | `@Paginated` / `@Expanded` | `goal/decorators.ts` |
| 多 ID 并发展开 | `@Expanded` | 同上 |
| 流式/推送累积 | `@Streamed` + `runStream` | `goal/streamed.ts` |
| 退避重试 | `RetryPolicy` | `puppeteer/retry.ts` |
| 资源"建连→用→必然释放" | `@Setup`/`@Ready` + `@Teardown` + Slot | `puppeteer/decorators.ts` |
| 响应形状校验 | `@Endpoint({schema})` | `goal/schema.ts` |
| 参数校验 | `paramSchema` + `validateWithSchema` | `skill/base.ts` |

> ⚠️ **`paramSchema.default` 框架不注入**，实际默认值必须在 `normalizeParams()` 里用 `??` 兜底。

### 第 1 步 · 跑决策提取器

```bash
node ${CLAUDE_PROJECT_DIR}/.claude/scripts/har-decide.mjs "$1"
```

它机械回答 5 个问题。**逐条读完再往下**——其中第 ②③ 项各自对应过一次真实事故
（凭证被拒 / CORS 预检被拒），都是只在真机暴露、单测抓不到的那类。

| # | 问题 | 决定什么 |
|---|---|---|
| ① | 是否需要登录态 | Goal 模式 vs 纯 HTTP |
| ② | **各 host 的 CORS 策略** | 每个 Goal 的 `credentials`（逐 host 可能不同！） |
| ③ | **请求体真实 Content-Type** | body 返回 string 还是 object |
| ④ | 是否有 WS / SSE | 是否需要 `@Streamed`，或跳出 Goal 链 |
| ⑤ | 上游枚举 | 写成**提示清单**，绝不是白名单 |

### 第 2 步 · 让子代理产出装饰器映射表

用 Task 工具调 `spider-scaffolder` 子代理，把上一步的输出 + 接口清单交给它，
让它产出「每个接口 → 用哪个装饰器 + credentials + body 形态 + 理由」的表。

**为什么要交给子代理**：此刻你的上下文装满了 HAR 细节，正是最容易"顺手就写"的
时刻。子代理带干净上下文只做映射决策、不碰实现，能拦住惯性。

### 第 3 步 · 生成骨架

按映射表生成，**照抄 `skills/dedao-spider`（最小 Goal 包，20 个文件）的结构**：

```
skills/$0/
  package.json          # @spider/<短名>；deps 只有 @spider/core + puppeteer-core
  tsconfig.json         # 直接复制 skills/bilibili-spider/tsconfig.json（严格模板）
  vitest.config.ts      # 复制并改 name
  .gitignore            # *.har —— 抓包含真实凭据，不入库
  src/
    cli.ts              # runCLI 薄封装，silent: true
    registry.ts         # createDefaultRegistry，头部 JSDoc 列能力全景
    constants.ts        # 站点/端点常量 + 已验证枚举清单
    types/*.types.ts    # 三段式：Raw* → 领域对象 → *Projected
    thrall/shared.ts    # GOAL_DEFAULTS（含 credentials，理由写进注释）
    thrall/<x>.ts       # @Goal + @Endpoint + @Aggregate
    skills/<site>-skill-base.ts   # 只钉 siteURL，≤10 行
    skills/<x>.skill.ts           # id/name/description/paramSchema/createGoal/normalizeParams/pipeline
    projections/envelope.ts       # AI-Ready 信封（抄 bilibili-spider 的）
    projections/<x>.ai-ready.ts   # meta.semantics 必填
  docs/                 # HAR 放这里（被 gitignore）+ 分析文档
```

**先只做 1 个 Skill 跑通**，其余按同一模式复制。

### 第 4 步 · 立刻验证骨架可运行

```bash
yarn install
yarn workspace @spider/<短名> typecheck
cd skills/$0 && yarn skill --list      # 必须是纯 JSON，无日志污染
```

### 第 5 步 · 停下来汇报

告诉用户：已生成什么、5 项决策的答案是什么、下一步做什么。
**不要一口气把所有 Skill 都写完**——先让用户确认方向。

## 编码时的红线（写之前再扫一眼）

- ❌ 新建 `src/fetchers/` 或自写 `fetch(` → 走 Goal 引擎
- ❌ 自写 `setTimeout` 退避循环 → 用 `RetryPolicy`
- ❌ 自建 `withXxx` 资源包装器 → 用 `@Ready`/`@Teardown` + Slot
- ❌ 端点方法体里用 `this.` → **无 this 调用**，真机必崩
- ❌ 在 `normalizeParams` 里拦截**上游**枚举 → 只做形状校验（CLAUDE.md §3.6）
- ❌ 依赖同源的初始化挂 `@Setup` → 应挂 `@Ready`（setup 早于 navigate，页面还是 about:blank）
- ❌ `page.evaluate` 回调引用模块作用域标识符 → 真机 `xxx is not defined`

## 完成后

跑 `/spider-review` 做提交前自检。
