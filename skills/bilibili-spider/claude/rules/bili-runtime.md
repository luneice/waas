# bilibili-spider · 运行环境前置（差异部分）

> Chrome 远程调试端口前置（需已登录 B 站）、端口失败处置、风控熔断通用流程、`--raw` 开关见 `rules/spider-runtime.md`（随包安装）。本文件只写 bilibili 特有约束。

## 1. ffmpeg 前置（仅视频提取需要）

- `bili-video` 下载并合并 DASH 音视频流依赖本机 `ffmpeg`（BiliMuxer 调用）。
- 缺 ffmpeg → 合并失败。处置：
  - 仅需元数据/选流信息时用 `download:false`（不落媒体，不需 ffmpeg）；
  - 只需字幕时也用 `download:false`（字幕走 Node 直拉，与 ffmpeg 无关）；
  - 或 `merge:false` 保留分离的音/视频文件；
  - 否则提示用户安装 ffmpeg（macOS：`brew install ffmpeg`）。
- `download`（媒体）与 `subtitle`（字幕）两参数相互独立：只下视频用 `{"subtitle":false}`，只下字幕用 `{"download":false}`。

## 2. 风控熔断触发条件（对通用熔断流程的补充）

响应/控制台出现 `412`、`-352`、`风控`、`请登录`、Cookie 失效迹象时，触发 `spider-runtime.md §2` 的熔断流程。

## 3. 隐私墙 ≠ 错误

- `code=53013`「用户隐私设置未公开」、`data=null` 是**正常业务态**（UP 关闭了某模块）。
- 返回空集 + 提示，**不熔断、不重试、不报错**。

## 4. 落盘目录

- 提取类副作用落盘到 `--storage-dir` 指定的 `storageRoot`，默认子目录 `bilibili/`（视频）/ `bilibili/articles/`（专栏）。
- 可经各 skill 的 `outputDir` 入参覆盖。
