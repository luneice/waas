# 说明
该项目基于 `puppeteer` 实现，借鉴了 `nestjs` 的设计思路，提供了少量的装饰器，仅仅聚焦于数据流的处理。

该爬虫主要原理是使用浏览器完成对网络请求的监听，处理特定请求接口数据，完成对数据的收集。目前需要手动操作浏览器，完成请求的触发。自动触发的实现逻辑在设计中。

## 文档导航

- [packages/core/ARCHITECTURE.md](./packages/core/ARCHITECTURE.md) — 核心框架架构（Goal/Skill/Lifecycle/CLI）
- [OBSERVABILITY.md](./OBSERVABILITY.md) — **可观测性使用指南**（trace 查询、AI rationale、脚本/管道场景、自定义事件）

## 可观测性快速入门

每次运行 Skill 都会自动产出可查询的调用链数据到 `~/.spider/`（跨 cwd 共享，可用 `SPIDER_OBS_DIR` 重设）：

```bash
# 1. 跑任意 Skill，附带"为什么调用"
node dist/dedao-spider/scripts/index.js course-search '{"keyword":"AI"}' \
  --rationale "用户问 AI 课的热度趋势" --caller "claude-sonnet-4"

# 2. 立即查询调用链
node dist/dedao-spider/scripts/index.js obs recent           # 最近的 trace
node dist/dedao-spider/scripts/index.js obs trace <id>       # 完整 span 树
node dist/dedao-spider/scripts/index.js obs slow             # 慢调用排序
node dist/dedao-spider/scripts/index.js obs http --url xxx   # HTTP 历史
node dist/dedao-spider/scripts/index.js obs body <hash>      # dump 请求/响应原文
```

完整说明见 [OBSERVABILITY.md](./OBSERVABILITY.md)。

## Skill 打包：项目模式 vs 全局模式

`scripts/build-skill.js` 支持把任意 `skills/<name>/` 打包到两种 Claude Code 安装位置：

| 模式 | 命令 | 产物根 | 适用 |
|---|---|---|---|
| project（默认） | `yarn build:<name>` | 默认 `dist/<name>/`，下面再嵌 `.claude/`；若 `BUILD_OUTPUT` 指向 `.claude`、`.claude/skills` 或已含 `.claude` 的项目根，则直接安装到该 Claude 根 | 独立项目，或按 env 安装到用户/项目级 `.claude` |
| global | `yarn build:<name>:global` | `~/.claude/`（或 `--output` 指定的"全局根"），扁平铺开 | 跨项目复用，覆盖式更新 |

新源码布局（`skills/<name>/claude/`）：

```
skills/<name>/claude/
├── skills/<name>/{SKILL.md, references/}
├── rules/<prefix>-*.md     # 可选；文件名带前缀防全局撞名
├── agents/                 # 可选
├── commands/               # 可选
├── memory/                 # 可选
└── CLAUDE.md               # 可选
```

产物对照：

```
# project（默认 dist 产物）
dist/<name>/.claude/{skills/<name>/{SKILL.md, references/, scripts/}, rules/, memory/}

# project（BUILD_OUTPUT=/path/to/project、/path/to/.claude/skills 或 /path/to/.claude）
/path/to/.claude/skills/<name>/{SKILL.md, references/, scripts/}
/path/to/.claude/rules/<prefix>-*.md
/path/to/.claude/{agents/, commands/, memory/, CLAUDE.md}

# global  ← 直接覆盖 ~/.claude/
~/.claude/skills/<name>/{SKILL.md, references/, scripts/}
~/.claude/rules/<prefix>-*.md
# memory/ 与 .env 跳过（auto memory 由 Claude 自管）
```

CLI 选项：

- `--target <project|global>`（默认 `project`）
- `--output, -o <dir>`：project 模式 = 项目根（若已有 `.claude/` 会直接安装进去），或直接指向 `.claude` / `.claude/skills`；global 模式 = 全局根（如 `--output ~/.claude.work`）

约束与安全：

- global 模式只清理 `<root>/skills/<name>/` 与匹配前缀的 `<root>/rules/*.md`，**绝不删整个 `~/.claude/`**
- 允许的 rule 前缀：完整 skill 名（如 `xhs-spider-*.md`）或首段 hyphen-token（如 `xhs-*.md`）。其它前缀会打印 ⚠️
- `.env` 中的 `BUILD_OUTPUT` 仅作用于 project 模式。可写已有 `.claude/` 的项目根（直接安装到 `<root>/.claude/...`），也可直接写用户或项目级 `.claude/skills`（产出到同级 `.claude/skills`、`.claude/rules` 等正确位置）；若项目根没有 `.claude/`，仍会按独立产物输出到 `<root>/<name>/.claude/...`
- 旧 `assets/` 布局只支持 project 模式，global 模式会直接报错要求迁移

> **构建产物**：以 Node 22 为目标，统一通过 `scripts/index.js` 运行。构建不再读取私钥或注入授权公钥，
> 不生成授权字节码、完整性签名或 V8 ABI 门禁；core 中的授权实现保留，产物走无公钥放行分支。
> 默认仍启用业务代码混淆；`--dev` 默认关闭混淆，`--obfuscate` / `--no-obfuscate` 可显式覆盖。

## RSSHub 默认运行时

`skills/rss-spider` 内置 RSSHub 内嵌运行时，route 模式在命令进程内直接执行 `rsshub://embedded`，不再暴露常驻本地 HTTP 服务，也不依赖 Docker Compose 或 Redis。

- 可通过 `RSSHUB_BASE_URL` 或调用参数 `rsshubBase` 切换到外部 RSSHub 实例
- 浏览器依赖 route 会优先复用 `BROWSER_URL` 对应的项目浏览器环境，也可显式设置 `RSSHUB_PUPPETEER_WS_ENDPOINT`

## 启动浏览器

### MacOC/Linux 系统
要在MacOC/Linux上启动Chrome并启用远程调试，可以使用以下命令行参数：
```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=4444 --remote-debugging-address=127.0.0.1 --user-data-dir=/Users/luneice/chrome --headless=new
```

如果你使用的是Chromium而不是Google Chrome，命令可能会是：

```sh
chromium-browser --remote-debugging-port=4444 --remote-debugging-address=127.0.0.1    
```
### Windows 系统
打开 cmd 窗口，执行下面的命令
```cmd
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe"  --remote-debugging-port=4444 --remote-debugging-address=127.0.0.1
```


> 浏览器启动后，在浏览器的导航栏中访问 chrome://version/ 获取详细信息，确保得到类似以下的输出

```text
 Google Chrome:	127.0.6533.73 (正式版本) （64 位） (cohort: Stable Installs & Version Pins) 
       修订版本:	b59f345ebd6c6fffffff2a715334e912b514773d-refs/branch-heads/6533@{#1761}
       操作系统:	Windows 10 Version 21H2 (Build 19044.4780)
    JavaScript:	V8 12.7.224.16
       用户代理:	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36
         命令行:	"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=4444 --remote-debugging-address=127.0.0.1 --flag-switches-begin --flag-switches-end
  可执行文件路径:	C:\Program Files\Google\Chrome\Application\chrome.exe
    个人资料路径:	C:\Users\xxxx\AppData\Local\Google\Chrome\User
    使用中的变体:	xxxxxxxxxxxxxxx
```