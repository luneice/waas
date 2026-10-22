<!-- spider-shared v1 · 由任一 spider skill 构建时携带安装，以最后安装为准 -->

# spider 通用 · 调用与数据处理协议（始终生效）

> 适用于本套所有数据采集 skill（bili-* / xhs-* / rss-* / dedao / eastmoney / polymarket / report 等）。
> 各 skill 自己的 rules 只写与本文件的**差异**，不重复本文件内容。

## 1. 一次只执行一条命令

- **适用于一切终端命令**：包括 `ls`、`cat`、`jq`、skill 调用在内，每次只执行**一条**命令，等结果返回后再发下一条。
- 禁止用 `&&`、`;`、`|`、`||`、`$(...)`、反引号、`xargs`、子 shell 把多条命令拼到同一行。
- 禁止 `cd <dir> && node ...` 这类拼接——会改变相对路径和环境上下文，且破坏逐条安全审查。

```bash
node /abs/path/.claude/skills/<name>/scripts/index.js A   # ✅
node scripts/index.js A && jq '.data' result.json          # ❌ 拼接
cd .claude/skills/<name> && node scripts/index.js A        # ❌ cd 拼接
```

## 2. 统一调用形式（绝对路径）

```bash
node ${CLAUDE_SKILL_DIR}/scripts/index.js <skill-id> '<json-input>'
```

- 用 SKILL.md 所在目录推导出的**绝对路径**调用，不用相对路径（cwd 不是 skill 目录）。
- 辅助命令：`--list` 查看能力目录；部分 skill 支持 `--describe <id>`。

## 3. 数据提取只用 jq / rq

- JSON 的筛选、切片、字段提取、聚合，统一用 `jq`；跨格式查询用 `rq`。
- **取数与提取分两步**：先运行取数命令（必要时 stdout 存为 JSON 文件），再用独立的下一条 `jq` 处理，不与取数命令拼管道。
- 严禁生成或运行临时脚本解析数据：不写 `.py`/`.js`/`.sh`，不用 `python -c`、`node -e` 等内联脚本。
- 不要用 `grep`/`sed`/`awk` 从 JSON 里抓字段（`grep` 仅用于纯文本粗筛）。

## 4. 优先从源头缩小数据

- 优先用 skill 自带参数（分页 / 日期区间 / limit / fields 等）缩小返回范围；参数无法满足时才用 `jq` 二次提取。

## 5. ID 严禁猜测

- 各 skill 的数字/哈希类 ID（`mid`、`bloggerId`、`token_id`、`contentHash`、游标 offset 等）**严禁传名称或自行编造**，必须来自上游 skill 的真实输出。
- 没有 ID 时先走对应的搜索/元数据 skill 拿 ID，再调下游。各 skill 的 ID 来源表见其自身 rules / references。

## 6. 并行化

- 建议 ≤5 路并发。
- 可并行：互不依赖的独立 skill 调用。
- 不可并行：下游依赖上游 ID 的链路（先搜后取）。批量下载/提取建议串行，便于错误定位。
