# `.claude/` — 仓库级 Claude Code 基建

这些文件与代码同源、随代码一起演进。

## 为什么存在

新增 spider 包时，实现阶段反复出现**造轮子**：手写 HTTP 层、自建 RAII 包装器、
自写退避循环——而这些能力框架早已提供。事后被纠正，再回头深入调研其它包的实现，
每次都要重来一遍。

归因发现问题**不是"不知道"**：这些指引 CLAUDE.md 与框架源码注释里本来就写着，
而且是读过之后照样违反的。真正的失效链条是：

1. **规格是"读物"，不是"检查点"** —— 读完进入编码，注意力转到"怎么让它跑起来"
2. **发现太晚** —— 造完一整层才被发现，此时已产生沉没成本，还会给已写的代码找理由
3. **正确路径的启动成本高于错误路径** —— 手写 fetch 立刻会写；用 Goal 要先搞清
   装饰器语义。**惯性总是流向启动成本低的那条路**

所以这里的东西**不是第 5 份文档**，而是把规格变成动作、把发现提前到写代码之前、
把正确路径的启动成本压到低于手写。

## 内容

| 路径 | 作用 |
|---|---|
| `scripts/har-decide.mjs` | 从 HAR **机械提取** 5 项决策（登录态 / 逐 host CORS / Content-Type / 流式 / 上游枚举） |
| `skills/new-spider/SKILL.md` | `/new-spider <包名> <HAR路径>`，带强制顺序：先决策 → 再生成骨架 → 立刻验证 → 停下汇报 |
| `agents/spider-scaffolder.md` | 子代理，在写业务代码**之前**产出「接口 → 装饰器」映射表 |

## 有效性验证（不是设想，是实测）

拿本轮 tradingview-spider 的真实 HAR 回放：

- `har-decide.mjs` **抓出了当时踩的两个坑**——`symbol-search` 需 `credentials: "omit"`
  （响应头无 allow-credentials）、`scanner` 的 POST 是 `text/plain`（body 必须发 string）。
  这两条当初各耗费数轮真机调试才定位。
- `spider-scaffolder` 的判据交给一个**不看现有实现**的代理，独立得出了与已落地代码
  完全一致的选型，包括三个反直觉的坑：`@Paginated.stopWhen` 拿不到 ctx、
  非分页端点的 `resolveUrl` 不替换路径段、`text/plain` 必须发 string。

## 使用

```bash
/new-spider foo-spider skills/foo-spider/docs/foo.har
```

或先单独看决策：

```bash
node .claude/scripts/har-decide.mjs <path-to.har>
```

## 维护须知

- **`.claude/skills/` 或 `.claude/agents/` 目录首次创建后需重启会话**才会被加载；
  之后改文件内容是热加载的。
- Claude Code 的位置参数 **`$0` 是第一个、`$1` 是第二个**（与 shell 直觉相反）。
- 子代理身份只看 frontmatter 的 `name` 字段，与文件名无关；`name` 需全树唯一。
- 判据变更时，同步更新 `CLAUDE.md` 对应章节——两者是同一套规则的两种载体，
  一个给人读、一个给执行时用，漂移了就都不可信。
