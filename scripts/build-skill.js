#!/usr/bin/env node
/**
 * 统一 Skill 打包脚本 — 基于 esbuild
 *
 * Usage:
 *   node scripts/build-skill.js <skill-name> [options]
 *
 * Options:
 *   --target <mode>  project (默认) | global
 *                    project: 默认把整个 skill 打包成一个 Claude Code "项目根"
 *                             产物布局：<output>/.claude/{skills/<name>/, rules/, agent-memory/}
 *                             agent-memory 为播种制：目标文件已存在则跳过，绝不覆盖
 *                             若 --output / BUILD_OUTPUT 指向 .claude、其资源子目录，
 *                             或已含 .claude 的项目根，
 *                             则直接安装到该 Claude 根：<claude>/skills/<name>/、<claude>/rules/ ...
 *                    global:  直接覆盖到全局 ~/.claude/，无 memory/（auto memory 由 Claude 自管）
 *                             产物布局：<root>/skills/<name>/{SKILL.md, references/, scripts/}
 *                                       <root>/rules/<name>-*.md
 *   --output, -o     输出目录覆盖：
 *                    project 模式：默认 dist/<name>，也可用 BUILD_OUTPUT 环境变量
 *                    global  模式：默认 ~/.claude，传值则把它当作"全局根"使用
 *   --obfuscate /    强制开启 / 关闭产物混淆（javascript-obfuscator）。
 *   --no-obfuscate   缺省策略：正式态构建默认开启，--dev 默认关闭。
 *   --dev           开发构建，默认关闭业务混淆；所有构建均不注入授权配置。
 *
 * 从 skill 的 package.json 读取可选 buildConfig:
 *   buildConfig.entry     — 入口文件（默认: src/cli.ts）
 *   buildConfig.externals — 排除的包列表，构建后自动安装到产物 node_modules
 *
 * docsOnly（无 package.json 的纯 Agent/Command/规则资源包，如 finance-analyst）：
 *   跳过 esbuild/混淆 全部步骤，只搬运 claude/ 资源树；project/global 两种 target 均支持。
 *   仍要求新版 claude/ 布局（skills/<name>/claude/skills/<name>/SKILL.md 必须存在）。
 *
 * claude/agents/ 与 claude/commands/（及未来同级新增资源目录）在 global 模式下会被复制到
 * globalRoot/agents/、globalRoot/commands/ —— 这是本脚本 2026-08 修的一个此前的静默缺陷：
 * 早期版本 global 分支只复制 skills/ 与 rules/，含这两个目录的包（rss-spider/xhs-spider/
 * finance-analyst）跑 --target global 会丢失全部 Agent/Command 文件且无任何报错。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(ROOT, ".env") });

// ── 解析 CLI 参数 ──
const args = process.argv.slice(2);
let skillName = null;
let cliOutput = null;
let target = "project";
let devBuild = false;
let obfuscateFlag = null; // null = 自动（正式态开 / --dev 关）

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--output" || args[i] === "-o") {
    cliOutput = args[++i];
  } else if (args[i] === "--target" || args[i] === "-t") {
    target = args[++i];
  } else if (args[i] === "--dev" || args[i] === "--allow-no-license") {
    devBuild = true;
  } else if (args[i] === "--obfuscate") {
    obfuscateFlag = true;
  } else if (args[i] === "--no-obfuscate") {
    obfuscateFlag = false;
  } else if (!args[i].startsWith("-")) {
    skillName = args[i];
  }
}

if (!["project", "global"].includes(target)) {
  console.error(`❌ Invalid --target: ${target} (expected: project | global)`);
  process.exit(1);
}

// 计算允许的 rule 文件前缀（防全局模式撞名）
// 完整名（xhs-spider）与首段（xhs）都视为合法前缀
function rulePrefixes(name) {
  const head = name.split("-")[0];
  return head === name ? [`${name}-`] : [`${name}-`, `${head}-`];
}

// 共享规则命名空间：skills/_shared/claude/rules/spider-*.md 随任一 skill 携带安装。
// 禁止任何 skill 占用 spider- 前缀，否则其 cleanRuleFiles 会误删共享文件。
const SHARED_RULE_PREFIX = "spider-";
const SHARED_RULES_SRC_DIR = path.join(
  __dirname,
  "..",
  "skills",
  "_shared",
  "claude",
  "rules",
);

function copySharedRules(rulesDir) {
  if (!fs.existsSync(SHARED_RULES_SRC_DIR)) return 0;
  fs.mkdirSync(rulesDir, { recursive: true });
  let copied = 0;
  for (const f of fs.readdirSync(SHARED_RULES_SRC_DIR)) {
    if (!f.endsWith(".md") || !f.startsWith(SHARED_RULE_PREFIX)) continue;
    fs.cpSync(path.join(SHARED_RULES_SRC_DIR, f), path.join(rulesDir, f));
    copied++;
  }
  return copied;
}

const CLAUDE_RESOURCE_DIRS = new Set([
  "skills",
  "rules",
  "agents",
  "commands",
  "memory",
]);

function resolveOutputPath(outputPath) {
  if (!outputPath) return null;
  const trimmed = outputPath.trim();
  if (trimmed === "~") return os.homedir();
  if (trimmed.startsWith(`~${path.sep}`)) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  return path.resolve(trimmed);
}

function looksLikeClaudeRoot(dir) {
  const base = path.basename(dir);
  return base === ".claude" || base.startsWith(".claude.") || base === ".hermes";
}

function isDirectory(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function findChildClaudeRoot(dir) {
  if (!isDirectory(dir)) return null;

  const defaultClaudeRoot = path.join(dir, ".claude");
  if (isDirectory(defaultClaudeRoot)) return defaultClaudeRoot;

  let entryNames;
  try {
    entryNames = fs.readdirSync(dir);
  } catch {
    return null;
  }

  for (const entryName of entryNames) {
    const candidate = path.join(dir, entryName);
    if (looksLikeClaudeRoot(candidate) && isDirectory(candidate)) {
      return candidate;
    }
  }

  return null;
}

function detectClaudeRoot(outputPath) {
  const resolved = resolveOutputPath(outputPath);
  if (!resolved) return null;

  if (looksLikeClaudeRoot(resolved)) return resolved;

  const base = path.basename(resolved);
  const parent = path.dirname(resolved);
  if (CLAUDE_RESOURCE_DIRS.has(base) && looksLikeClaudeRoot(parent)) {
    return parent;
  }

  const grandparent = path.dirname(parent);
  if (
    base === skillName &&
    path.basename(parent) === "skills" &&
    looksLikeClaudeRoot(grandparent)
  ) {
    return grandparent;
  }

  const childClaudeRoot = findChildClaudeRoot(resolved);
  if (childClaudeRoot) return childClaudeRoot;

  return null;
}

function cleanRuleFiles(rulesDir, name) {
  const prefixes = rulePrefixes(name);
  if (!fs.existsSync(rulesDir)) return;
  for (const f of fs.readdirSync(rulesDir)) {
    if (!f.endsWith(".md")) continue;
    if (prefixes.some((p) => f.startsWith(p))) {
      fs.rmSync(path.join(rulesDir, f), { force: true });
    }
  }
}

function shouldCopyFile(src) {
  return path.basename(src) !== ".DS_Store";
}

function copyRecursive(src, dest) {
  fs.cpSync(src, dest, {
    recursive: true,
    filter: shouldCopyFile,
  });
}

function copyClaudeTree(srcRoot, destRoot) {
  fs.mkdirSync(destRoot, { recursive: true });
  for (const entryName of fs.readdirSync(srcRoot)) {
    // memory 已废弃；agent-memory 是演化数据，单独播种（exists-skip），不走覆盖式复制
    if (entryName === "memory" || entryName === "agent-memory") continue;
    const src = path.join(srcRoot, entryName);
    if (!shouldCopyFile(src)) continue;
    copyRecursive(src, path.join(destRoot, entryName));
  }
}

// agent-memory 播种：只在目标文件不存在时落地种子，绝不覆盖 Claude 演化中的记忆
function seedAgentMemory(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return { seeded: 0, skipped: 0 };
  let seeded = 0;
  let skipped = 0;
  for (const agentName of fs.readdirSync(srcDir)) {
    const agentSrc = path.join(srcDir, agentName);
    if (!isDirectory(agentSrc)) continue;
    const agentDest = path.join(destDir, agentName);
    fs.mkdirSync(agentDest, { recursive: true });
    for (const f of fs.readdirSync(agentSrc)) {
      const fileSrc = path.join(agentSrc, f);
      if (!shouldCopyFile(fileSrc) || isDirectory(fileSrc)) continue;
      const fileDest = path.join(agentDest, f);
      if (fs.existsSync(fileDest)) {
        skipped++;
        continue;
      }
      fs.cpSync(fileSrc, fileDest);
      seeded++;
    }
  }
  return { seeded, skipped };
}

if (!skillName) {
  // 尝试从 skills/*/package.json 自动发现（在 workspace 子目录下运行时）
  const cwd = process.cwd();
  const rel = path.relative(path.join(ROOT, "skills"), cwd);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
    skillName = rel.split(path.sep)[0];
  }
}

if (!skillName) {
  console.error(
    "Usage: node scripts/build-skill.js <skill-name> [--output <dir>]",
  );
  process.exit(1);
}

const skillDir = path.join(ROOT, "skills", skillName);
if (!fs.existsSync(skillDir)) {
  console.error(`❌ Skill not found: skills/${skillName}`);
  process.exit(1);
}

// spider- 是共享规则的保留前缀（见 SHARED_RULE_PREFIX）
if (rulePrefixes(skillName).some((p) => SHARED_RULE_PREFIX.startsWith(p))) {
  console.error(
    `❌ Skill name "${skillName}" collides with shared rule prefix "${SHARED_RULE_PREFIX}" — its clean step would delete shared rules`,
  );
  process.exit(1);
}

// ── 读取 skill package.json（可选：纯文档 skill 无 package.json，见下方 docsOnly）──
const skillPkgPath = path.join(skillDir, "package.json");
const hasPkg = fs.existsSync(skillPkgPath);
const pkg = hasPkg ? JSON.parse(fs.readFileSync(skillPkgPath, "utf8")) : {};
const buildConfig = pkg.buildConfig || {};
const entry = buildConfig.entry || "src/cli.ts";
const externals = buildConfig.externals || [];

// ── 源布局检测 ──
// 新布局：skills/<name>/claude/{skills/<name>/SKILL.md, rules/, memory/}
// 旧布局：skills/<name>/assets/{SKILL.md, references/...}（兼容期保留）
const claudeSrcDir = path.join(skillDir, "claude");
const legacyAssetsDir = path.join(skillDir, "assets");
const useNewLayout = fs.existsSync(claudeSrcDir);
if (useNewLayout) {
  const expectedSkillMd = path.join(
    claudeSrcDir,
    "skills",
    skillName,
    "SKILL.md",
  );
  if (!fs.existsSync(expectedSkillMd)) {
    console.error(
      `❌ New layout detected but missing: claude/skills/${skillName}/SKILL.md`,
    );
    process.exit(1);
  }
}

// docsOnly：无 package.json 的纯 Agent/Command/规则资源包（如 finance-analyst）——
// 没有可编译的业务代码，构建时跳过 esbuild/混淆，只搬运 claude/ 资源树。
// 必须同时满足新布局，否则无法判定 SKILL.md 该去哪找（旧布局 skill 一律要求 package.json）。
const docsOnly = !hasPkg && useNewLayout;
if (!hasPkg && !useNewLayout) {
  console.error(
    `❌ skills/${skillName} 既无 package.json 也不是新版 claude/ 布局，无法判定构建方式`,
  );
  process.exit(1);
}

// ── 输出布局（按 target 区分） ──
//
// project:  默认 outputDir = dist/<name> 或自定义项目根；scripts → outputDir/.claude/skills/<name>/scripts
//           若 --output / BUILD_OUTPUT 指向 .claude、.claude/skills、.claude/skills/<name>
//           或已含 .claude 的项目根，
//           直接安装到该 Claude 根；scripts → <claudeRoot>/skills/<name>/scripts
//           assets layout 旧 skill 仍走 outputDir/scripts
// global:   globalRoot = ~/.claude 或 --output 指定；scripts → globalRoot/skills/<name>/scripts
//           rules 单独散落到 globalRoot/rules/<name>-*.md
//           不输出 memory/（auto memory 由 Claude Code 在 ~/.claude/projects/<repo>/memory/ 自管）
//           legacy assets 不支持 global，需先迁移到 claude/ 布局
let outputDir; // project: 项目根或 skill 包根 / global: skill 包根（globalRoot/skills/<name>）
let globalRoot = null;
let projectClaudeRoot = null;
let directClaudeInstall = false;
let scriptsDir;
let skillRefDestRoot; // SKILL.md + references 复制到此处的 skills/<name> 子目录
let rulesDestDir;

if (target === "global") {
  if (!useNewLayout) {
    console.error(
      `❌ --target global requires the new claude/ layout. Migrate skills/${skillName}/assets/ first.`,
    );
    process.exit(1);
  }
  globalRoot = cliOutput
    ? resolveOutputPath(cliOutput)
    : path.join(os.homedir(), ".claude");
  outputDir = path.join(globalRoot, "skills", skillName);
  scriptsDir = path.join(outputDir, "scripts");
  skillRefDestRoot = path.join(globalRoot); // 后面拼 skills/<name>
  rulesDestDir = path.join(globalRoot, "rules");
} else {
  const outputOverride = cliOutput || process.env.BUILD_OUTPUT || null;
  projectClaudeRoot = useNewLayout ? detectClaudeRoot(outputOverride) : null;
  directClaudeInstall = Boolean(projectClaudeRoot);

  if (directClaudeInstall) {
    outputDir = path.join(projectClaudeRoot, "skills", skillName);
  } else {
    outputDir = outputOverride
      ? path.join(resolveOutputPath(outputOverride), skillName)
      : path.join(ROOT, "dist", skillName);
  }

  if (useNewLayout) {
    projectClaudeRoot = directClaudeInstall
      ? projectClaudeRoot
      : path.join(outputDir, ".claude");
    scriptsDir = path.join(projectClaudeRoot, "skills", skillName, "scripts");
    skillRefDestRoot = projectClaudeRoot;
    rulesDestDir = path.join(projectClaudeRoot, "rules");
  } else {
    scriptsDir = path.join(outputDir, "scripts");
  }
}

// 清理旧产物（注意 global 模式只清 skill 自己的目录与自己的 rules 文件，绝不删 ~/.claude 整体）
if (target === "global") {
  fs.rmSync(outputDir, { recursive: true, force: true });
  // 删除该 skill 之前散落的 rules 文件（约定：文件名以 <skillName>- 或 <head>- 开头）
  cleanRuleFiles(rulesDestDir, skillName);
} else if (directClaudeInstall) {
  fs.rmSync(outputDir, { recursive: true, force: true });
  cleanRuleFiles(rulesDestDir, skillName);
} else {
  fs.rmSync(outputDir, { recursive: true, force: true });
}
// docsOnly 没有 scripts/index.js 产物，不预创建 scripts 目录（避免留空目录）
if (!docsOnly) fs.mkdirSync(scriptsDir, { recursive: true });

console.log(`🔨 Building skill: ${skillName}`);
console.log(`   target:   ${target}`);
console.log(
  `   layout:   ${docsOnly ? "claude/ (docs-only, no package.json)" : useNewLayout ? "claude/ (new)" : "assets/ (legacy)"}`,
);
if (!docsOnly) console.log(`   entry:    ${entry}`);
if (target === "global") {
  console.log(`   global:   ${globalRoot}`);
  console.log(`   skill:    ${outputDir}`);
  console.log(
    `   rules:    ${rulesDestDir}/{${rulePrefixes(skillName)
      .map((p) => p + "*")
      .join(",")}}.md`,
  );
} else {
  if (directClaudeInstall) {
    console.log(`   claude:   ${projectClaudeRoot}`);
    console.log(`   skill:    ${outputDir}`);
    console.log(
      `   rules:    ${rulesDestDir}/{${rulePrefixes(skillName)
        .map((p) => p + "*")
        .join(",")}}.md`,
    );
  } else {
    console.log(`   output:   ${outputDir}`);
  }
}
if (!useNewLayout && fs.existsSync(legacyAssetsDir)) {
  console.log(
    `   ⚠️  legacy assets layout — please migrate to skills/${skillName}/claude/`,
  );
}
if (externals.length) {
  console.log(`   externals: ${externals.join(", ")}`);
}

// ── 业务混淆配置 ──
//
// 业务 bundle 必须保持序列化安全：
//   业务代码含 page.evaluate(fn)，fn 会被 fn.toString() 序列化后注入浏览器执行。
//   任何把函数体内字面量/引用外提到父作用域、或改写函数源文本的变换，都会导致
//   序列化后的回调在浏览器端引用到 Node 侧符号 → ReferenceError / SyntaxError。
//   已实测确认会破坏序列化的选项（全部必须关闭）：
//     · controlFlowFlattening —— 把内联回调的字符串外提为父作用域共享对象（_0xxxx is not defined）
//     · stringArray           —— 字面量抽取到模块级数组（回调引用不到）
//     · renameGlobals / transformObjectKeys / deadCodeInjection / numbersToExpressions
//   因此业务混淆只保留“函数体自洽、不外提”的变换：改名 + splitStrings + selfDefending。
const BUSINESS_OBFUSCATION_OPTIONS = {
  target: "node",
  compact: true,
  selfDefending: true,
  splitStrings: true,
  splitStringsChunkLength: 12,
  identifierNamesGenerator: "hexadecimal",
  // 以下必须关闭：会把回调内引用外提/改写源文本，破坏 page.evaluate(fn) 序列化
  controlFlowFlattening: false,
  stringArray: false,
  renameGlobals: false,
  transformObjectKeys: false,
  deadCodeInjection: false,
  numbersToExpressions: false,
  sourceMap: false,
};

async function main() {
  const outFile = path.join(scriptsDir, "index.js");

  if (docsOnly) {
    console.log(
      `\n📁 docs-only skill（无 package.json）— 跳过 esbuild/混淆，只搬运 claude/ 资源树`,
    );
  } else {
  // ── Step 1: esbuild（主业务 bundle）──
  console.log(`\n📦 esbuild...`);
  const result = await esbuild.build({
    entryPoints: [path.join(skillDir, entry)],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    outfile: outFile,
    external: externals,
    minify: true,
    treeShaking: true,
    tsconfig: path.join(skillDir, "tsconfig.json"),
    logLevel: "info",
    // core 保留授权实现；固定为空使产物走无公钥放行分支，不读取授权或机器绑定。
    define: {
      __LICENSE_PUBKEY__: '""',
      __BUILD_ID__: '""',
    },
  });

  if (result.errors.length) {
    process.exit(1);
  }

  // 处理 require.resolve 引用的运行时文件（esbuild 不会自动复制）
  for (const warning of result.warnings) {
    if (warning.id === "require-resolve-not-external" && warning.location) {
      const match = warning.text?.match(/"([^"]+)"/);
      if (match) {
        const refPath = match[1];
        const sourceDir = path.dirname(
          path.resolve(ROOT, warning.location.file),
        );
        const sourceFile = path.resolve(sourceDir, refPath);
        if (fs.existsSync(sourceFile)) {
          const dest = path.join(scriptsDir, path.basename(refPath));
          fs.cpSync(sourceFile, dest);
          console.log(`   📎 Copied runtime file: ${path.basename(refPath)}`);
        }
      }
    }
  }

  // ── Step 1c: 代码混淆（防逆向）──
  // 默认正式态开启、--dev 关闭；--obfuscate / --no-obfuscate 显式覆盖。
  // selfDefending 产物不可再被格式化/美化，后续步骤不得改写 index.js。
  const shouldObfuscate =
    obfuscateFlag === null ? !devBuild : obfuscateFlag;
  if (shouldObfuscate) {
    console.log(`\n🛡  Obfuscating bundle (javascript-obfuscator)...`);
    const JavaScriptObfuscator = require("javascript-obfuscator");
    let code = fs.readFileSync(outFile, "utf8");
    let shebang = "";
    if (code.startsWith("#!")) {
      const nl = code.indexOf("\n");
      shebang = code.slice(0, nl + 1);
      code = code.slice(nl + 1);
    }
    const started = Date.now();
    // 不破坏 page.evaluate(fn) 的 toString 序列化。
    const obfuscated = JavaScriptObfuscator.obfuscate(
      code,
      BUSINESS_OBFUSCATION_OPTIONS,
    ).getObfuscatedCode();
    fs.writeFileSync(outFile, shebang + obfuscated);
    const sizeMb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
    console.log(
      `   🛡  Obfuscated in ${((Date.now() - started) / 1000).toFixed(1)}s → ${sizeMb} MB`,
    );
  } else {
    console.log(`\n⚠️  Obfuscation skipped (dev build or --no-obfuscate)`);
  }

  // ── Step 2: 安装 external 依赖 ──
  if (externals.length) {
    console.log(`\n📦 Installing externals: ${externals.join(", ")} ...`);
    const rootPkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
    );
    const deps = {};
    for (const ext of externals) {
      const version =
        pkg.dependencies?.[ext] ||
        pkg.devDependencies?.[ext] ||
        rootPkg.dependencies?.[ext] ||
        rootPkg.devDependencies?.[ext];
      if (!version) {
        console.error(
          `❌ External "${ext}" not found in skill or root dependencies`,
        );
        process.exit(1);
      }
      deps[ext] = version;
    }
    // 生成临时 package.json 用于 npm install
    fs.writeFileSync(
      path.join(scriptsDir, "package.json"),
      JSON.stringify({ private: true, dependencies: deps }, null, 2),
    );
    execSync("npm install --production --ignore-scripts", {
      cwd: scriptsDir,
      stdio: "inherit",
    });
    // 清理临时文件
    fs.rmSync(path.join(scriptsDir, "package.json"), { force: true });
    fs.rmSync(path.join(scriptsDir, "package-lock.json"), { force: true });
    console.log(`✅ Externals installed`);
  }
  }

  // ── Step 3: 复制 SKILL.md / references / rules / agent-memory 播种 ──
  if (useNewLayout) {
    const srcSkillDir = path.join(claudeSrcDir, "skills", skillName);
    const srcRulesDir = path.join(claudeSrcDir, "rules");
    const srcAgentMemoryDir = path.join(claudeSrcDir, "agent-memory");

    if (target === "global") {
      // SKILL.md + references → globalRoot/skills/<name>/
      console.log(`\n📁 Copying SKILL.md + references → ${outputDir}`);
      for (const entryName of fs.readdirSync(srcSkillDir)) {
        const src = path.join(srcSkillDir, entryName);
        if (!shouldCopyFile(src)) continue;
        copyRecursive(src, path.join(outputDir, entryName));
      }
      // rules → globalRoot/rules/
      if (fs.existsSync(srcRulesDir)) {
        fs.mkdirSync(rulesDestDir, { recursive: true });
        let copied = 0;
        const allowed = rulePrefixes(skillName);
        for (const f of fs.readdirSync(srcRulesDir)) {
          if (!f.endsWith(".md")) continue;
          if (!allowed.some((p) => f.startsWith(p))) {
            console.warn(
              `   ⚠️  rule file "${f}" lacks any of [${allowed.join(", ")}] prefix — global mode may collide with other skills`,
            );
          }
          fs.cpSync(path.join(srcRulesDir, f), path.join(rulesDestDir, f));
          copied++;
        }
        console.log(`📁 Copied ${copied} rule(s) → ${rulesDestDir}`);
      }
      // 共享规则随包携带（幂等覆盖，spider-* 命名空间）
      {
        const shared = copySharedRules(rulesDestDir);
        if (shared) {
          console.log(
            `📁 Copied ${shared} shared rule(s) (${SHARED_RULE_PREFIX}*) → ${rulesDestDir}`,
          );
        }
      }
      // agent-memory → 跳过（memory: project 的 agent-memory 属于项目工作区，全局没有合理位置）
      if (fs.existsSync(srcAgentMemoryDir)) {
        console.log(
          `   ℹ️  agent-memory/ skipped in global mode (memory: project scope lives in the workspace's .claude/agent-memory/)`,
        );
      }
      // agents/ commands/（及未来新增的同级资源目录）→ globalRoot/agents/、globalRoot/commands/
      // 此前遗漏：global 模式只复制了 skills/ 与 rules/，含 claude/agents 或 claude/commands 的包
      // （rss-spider / xhs-spider / finance-analyst）跑 --target global 会静默丢失全部 Agent/Command 文件。
      for (const entryName of fs.readdirSync(claudeSrcDir)) {
        if (["skills", "rules", "memory", "agent-memory"].includes(entryName))
          continue;
        const src = path.join(claudeSrcDir, entryName);
        if (!isDirectory(src)) continue;
        const dest = path.join(globalRoot, entryName);
        copyRecursive(src, dest);
        const count = fs.readdirSync(src).filter((f) => f.endsWith(".md")).length;
        console.log(`📁 Copied ${count} ${entryName} file(s) → ${dest}`);
      }
    } else {
      // project 模式：默认复制到产物根的 .claude/；若 env/--output 已指向 Claude 根，则按 claude/ 镜像结构直接落位。
      console.log(`\n📁 Copying claude/ tree → ${projectClaudeRoot} ...`);
      copyClaudeTree(claudeSrcDir, projectClaudeRoot);
      // 共享规则随包携带（幂等覆盖，spider-* 命名空间）
      const shared = copySharedRules(path.join(projectClaudeRoot, "rules"));
      if (shared) {
        console.log(
          `📁 Copied ${shared} shared rule(s) (${SHARED_RULE_PREFIX}*) → ${path.join(projectClaudeRoot, "rules")}`,
        );
      }
      // agent-memory 播种（只在目标不存在时落地，绝不覆盖演化中的记忆）
      const mem = seedAgentMemory(
        srcAgentMemoryDir,
        path.join(projectClaudeRoot, "agent-memory"),
      );
      if (mem.seeded || mem.skipped) {
        console.log(
          `🌱 Agent memory: seeded ${mem.seeded} file(s), preserved ${mem.skipped} existing → ${path.join(projectClaudeRoot, "agent-memory")}`,
        );
      }
    }
  } else if (fs.existsSync(legacyAssetsDir)) {
    // legacy 仅支持 project 模式（global 模式已在前面拒绝）
    console.log(`\n📁 Copying assets (legacy layout)...`);
    fs.cpSync(legacyAssetsDir, outputDir, { recursive: true });
  }

  // ── Step 4: 复制 .env（仅 project 模式有项目根概念）──
  if (target !== "global") {
    const envFile = path.join(skillDir, ".env");
    if (fs.existsSync(envFile)) {
      fs.cpSync(envFile, path.join(outputDir, ".env"));
      console.log(`📁 Copied .env`);
    }
  }

  // ── 唯一入口检查 ──
  const obsoleteStub = path.join(scriptsDir, "stub.js");
  if (fs.existsSync(obsoleteStub)) {
    throw new Error(`检测到废弃入口，正式态与开发态都只允许 index.js: ${obsoleteStub}`);
  }

  console.log(`\n✅ Build complete: ${outputDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
