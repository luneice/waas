# 发现类 Skill · 完整参数

## tv-search — 标的检索

按关键词检索**全球任意标的**，产出 ticker 供下游使用。这是本包的入口。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `text` | string | ✅ | — | 检索关键词：标的代码、公司名或宏观指标英文名。宏观指标建议用英文，中文命中率低 |
| `searchType` | string | ❌ | 不限 | `stock`/`futures`/`forex`/`crypto`/`index`/`economic`/`bond`/`cfd`。查利率/CPI/逆回购传 `economic` |
| `exchange` | string | ❌ | 不限 | 限定交易所/数据源前缀（`NASDAQ`/`TVC`/`FRED`/`ECONOMICS`） |
| `lang` | string | ❌ | `zh` | 结果中 description 的语言 |
| `sortByCountry` | string | ❌ | `CN` | 优先排序的国家代码 |
| `start` | number | ❌ | `0` | 起始偏移，续取时传上次返回的 `meta.nextStart` |
| `maxPages` | number | ❌ | `1` | 连续翻页数，每页 50 条，上限 20 |
| `grouping` | boolean | ❌ | `false` | 合并同公司多交易所挂牌，开启后 `items[].alsoListedOn` 给出其它挂牌 |

**关键词示例**（均已实测命中）：

```
"interest rate"   → 各国利率（2816 个匹配）
"reverse repo"    → 各国逆回购（含 FRED 与 ECONOMICS 两套）
"SOFR"            → 担保隔夜融资利率
"BTCUSDT"         → 加密现货（多交易所）
"crude oil"       → 原油
"Nikkei" / "DAX"  → 各国指数
```

**输出要点**：`items[].namespace` 标注命名空间（决定能投喂给哪些下游 Skill）；`meta.remaining` 是**剩余**匹配数（不是总数），`meta.hasMore` + `meta.nextStart` 用于续取。

---

## tv-scan — 批量截面扫描

一次请求取多个标的的指定字段快照，或按条件筛选标的。**只返回当前值，无历史**。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `market` | string | ❌ | `global` | 扫描域路径段，取值与各域标的量见 conventions.md §5 |
| `tickers` | array | ❌ | — | 直接指定标的清单。⚠️ `FRED:` 前缀会被自动剔除 |
| `columns` | array | ❌ | `name,description,close,change` | 返回字段。**响应按此顺序解码**，`meta.columns` 会回显 |
| `filter` | array | ❌ | — | 过滤条件 `[{left,operation,right}]` |
| `preset` | string | ❌ | — | 服务端预置模板：`ipo_calendar` / `stocks_related_bonds` / `earning` |
| `sortBy` / `sortOrder` | string | ❌ | — / `desc` | 排序字段与方向 |
| `range` | array | ❌ | `[0,50]` | 分页起止下标，单次跨度上限 500 |
| `lang` | string | ❌ | `zh` | 文本字段语言 |

**filter 的 operation 实测取值**：

| operation | 含义 | right 形态 |
|---|---|---|
| `equal` | 相等 | 标量 |
| `in_range` | 区间 | 二元数组 |
| `nempty` | 非空 | 省略 |
| `has` | 数组包含 | 标量或数组 |
| `match` | 正则匹配 | 正则字符串 |

**两种用法**：

```jsonc
// ① 指定标的取值（横向对比）
{"tickers":["ECONOMICS:USINTR","ECONOMICS:CNINTR","ECONOMICS:JPINTR"]}

// ② 按域筛选（不需要先 search）
{"market":"crypto","columns":["name","close","change"],"sortBy":"close","sortOrder":"desc","range":[0,20]}
```

**响应解码要点**：上游返回的是**位置数组**，请求侧的 `columns` 顺序是唯一解码键。本 Skill 已自动还原为键值对，并把 `columns` 回显在 `meta` 里供核对。若上游返回的数组长度与 columns 不匹配，会抛 `upstream-shape-changed` 而非静默错位。

**被剔除的标的**：`meta.droppedTickers` 列出因不在扫描索引内被跳过的 ticker，insights 里也会明确告知并给出改用建议。
