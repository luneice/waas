/**
 * resolveStorageRoot — Skill 「就近」运行时数据根解析
 *
 * Skill 运行时产物（PDF / 解析结果 / 浏览器 artifact 等）应当跟随调用方所在的项目，
 * 而不是 skill 的安装目录或 process.cwd()（cwd 会因子目录唤起而漂移）。
 *
 * 优先级：
 *   1. CLI flag    --storage-dir <path>
 *   2. ENV         SPIDER_STORAGE_DIR
 *   3. 就近策略：
 *      a. 从 cwd 向上找 git 根         → <gitRoot>/.spider
 *      b. 不在 git 仓                  → <cwd>/.spider
 *   4. 兜底（cwd 不可写时）            → ~/.spider/runtime
 *
 * 与 Observability（SPIDER_OBS_DIR，默认 ~/.spider/obs）物理分离：
 *   - obs 是跨项目的全局诊断池
 *   - storageRoot 是跟项目走的就近数据池
 */
import { existsSync, promises as fs } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { homedir } from "node:os";

export interface ResolveStorageRootOptions {
  /** --storage-dir CLI 值 */
  cliFlag?: string;
  /** 起始 cwd（默认 process.cwd()） */
  cwd?: string;
  /** 环境变量表（默认 process.env） */
  env?: NodeJS.ProcessEnv;
}

export function resolveStorageRoot(
  opts: ResolveStorageRootOptions = {},
): string {
  const cwd = opts.cwd ?? process.cwd();
  const env = opts.env ?? process.env;

  if (opts.cliFlag && opts.cliFlag.trim()) return resolve(opts.cliFlag.trim());

  const envDir = env.SPIDER_STORAGE_DIR;
  if (envDir && envDir.trim()) return resolve(envDir.trim());

  const gitRoot = findGitRoot(cwd);
  if (gitRoot) return join(gitRoot, ".spider");

  if (cwd && cwd !== "/" && cwd.length > 1) return join(cwd, ".spider");

  return join(homedir(), ".spider", "runtime");
}

function findGitRoot(start: string): string | null {
  let cur = resolve(start);
  // 防止极端情况下死循环
  for (let i = 0; i < 64; i++) {
    if (existsSync(join(cur, ".git"))) return cur;
    const parent = dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
  return null;
}

/**
 * 若 storageRoot 的父目录是一个 git 工作区根，确保 .gitignore 包含 `.spider/`，
 * 避免运行时数据被无意中 commit。非 git 仓场景静默跳过。
 *
 * 幂等：已存在 `.spider/` 或 `.spider` 行则不重复追加。
 */
export async function ensureGitignore(storageRoot: string): Promise<void> {
  const root = resolve(storageRoot);
  const parent = dirname(root);
  // 仅当 parent 是 git 工作区根（含 .git）且 storageRoot 名为 .spider 时介入
  if (!existsSync(join(parent, ".git"))) return;
  const base = root.slice(parent.length + 1);
  if (base !== ".spider") return;

  const ignorePath = join(parent, ".gitignore");
  let content = "";
  try {
    content = await fs.readFile(ignorePath, "utf-8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const lines = content.split(/\r?\n/);
  if (lines.some((l) => l.trim() === ".spider/" || l.trim() === ".spider"))
    return;

  const prefix = content === "" || content.endsWith("\n") ? "" : "\n";
  const block = `${prefix}\n# spider 本地运行时数据（PDF / 解析产物 / 浏览器 artifact）\n.spider/\n`;
  await fs.writeFile(ignorePath, content + block, "utf-8");
}
