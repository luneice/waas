#!/usr/bin/env node
/**
 * License 工具（你私有使用，绝不打包进 skill 产物）
 *
 * 一个固定 RSA 私钥保存在仓库根 license-private.pem（已 gitignore）。
 * 所有 skill 构建都用它派生的公钥注入产物，因此一份 license 可通行所有 skill。
 *
 * 子命令：
 *   keygen [--force]
 *     生成固定 RSA 密钥对，私钥写入仓库根 license-private.pem。
 *     已存在则拒绝（重置会使所有已签发 license 与已构建产物失效），需 --force。
 *
 *   issue --sub <客户> --days <天数> [选项]
 *     用固定私钥签发一份 license（与构建解耦，任何时候可签）。
 *       --sub <s>        客户标识（必填）
 *       --days <n>       有效期天数（与 --exp 二选一）
 *       --exp <unixSec>  绝对过期时间（Unix 秒）
 *       --skills <csv>   授权 skill，逗号分隔；默认 "*"（全部）
 *       --seats <n>      绑定机器数上限，默认 1
 *       --out <path>     输出 license 文件；缺省打印到 stdout
 *
 * 用法示例：
 *   node scripts/license/cli.js keygen
 *   node scripts/license/cli.js issue --sub "acme" --days 365
 *   node scripts/license/cli.js issue --sub "acme" --days 365 --skills xhs-spider,bilibili-spider
 */
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");

// 加载根目录 .env（与 build 脚本一致），以便读取 LICENSE_PRIVATE_KEY_PATH
try {
  require("dotenv").config({ path: path.join(REPO_ROOT, ".env") });
} catch {
  /* dotenv 可选 */
}

function expandHome(p) {
  if (!p) return p;
  const t = p.trim();
  if (t === "~") return os.homedir();
  if (t.startsWith(`~${path.sep}`)) return path.join(os.homedir(), t.slice(2));
  return path.resolve(t);
}

// 私钥路径优先级：--key flag > LICENSE_PRIVATE_KEY_PATH 环境变量 > 仓库根（与 build 脚本一致）
function resolvePrivateKeyPath(args) {
  if (args && args.key) return expandHome(args.key);
  if (process.env.LICENSE_PRIVATE_KEY_PATH) {
    return expandHome(process.env.LICENSE_PRIVATE_KEY_PATH);
  }
  return path.join(REPO_ROOT, "license-private.pem");
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function keygen(args) {
  const keyPath = resolvePrivateKeyPath(args);
  if (fs.existsSync(keyPath) && !args.force) {
    console.error(
      `❌ 私钥已存在: ${keyPath}\n` +
        `   重新生成会使所有已签发的 License 与已构建的产物全部失效。\n` +
        `   如确需重置（之后需重新构建所有 skill 并重发 license），加 --force。`,
    );
    process.exit(1);
  }

  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const privPem = privateKey.export({ type: "pkcs8", format: "pem" });
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(keyPath, privPem, { mode: 0o600 });

  console.log("✅ 固定私钥已生成");
  console.log(`   私钥（离线保管、请备份）: ${keyPath}`);
  console.log("");
  console.log("接下来构建任意 skill 都会自动用它派生公钥注入产物：");
  console.log("   npm run build:xhs-spider");
  console.log("签发可通行所有 skill 的 license：");
  console.log('   npm run license:issue -- --sub "客户A" --days 365   # 默认 --skills "*"');
}

function loadPrivateKey(args) {
  const keyPath = resolvePrivateKeyPath(args);
  if (!fs.existsSync(keyPath)) {
    console.error(
      `❌ 私钥不存在: ${keyPath}\n   请先运行: npm run license:keygen`,
    );
    process.exit(1);
  }
  return crypto.createPrivateKey(fs.readFileSync(keyPath, "utf8"));
}

function issue(args) {
  if (!args.sub) {
    console.error("❌ --sub <客户标识> 必填");
    process.exit(1);
  }
  const privateKey = loadPrivateKey(args);

  const now = Math.floor(Date.now() / 1000);
  let exp;
  if (args.exp) {
    exp = parseInt(args.exp, 10);
  } else if (args.days) {
    exp = now + parseInt(args.days, 10) * 86400;
  } else {
    console.error("❌ 必须提供 --days <天数> 或 --exp <unixSec>");
    process.exit(1);
  }

  const skills = args.skills
    ? String(args.skills)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : ["*"];
  const seats = args.seats ? parseInt(args.seats, 10) : 1;

  const payload = {
    sub: String(args.sub),
    skills,
    iat: now,
    exp,
    seats,
    nonce: crypto.randomUUID(),
  };

  const payloadB64 = b64url(JSON.stringify(payload));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(Buffer.from(payloadB64, "utf8"));
  signer.end();
  const token = `${payloadB64}.${b64url(signer.sign(privateKey))}`;

  const expDate = new Date(exp * 1000).toISOString();
  if (args.out) {
    fs.writeFileSync(path.resolve(args.out), token);
    console.error(`✅ License 已写入: ${path.resolve(args.out)}`);
  } else {
    console.error("✅ License（交付给客户，放入 ~/.spider/.env 的 SPIDER_LICENSE=）:");
  }
  console.error(`   客户:   ${payload.sub}`);
  console.error(`   skills: ${skills.join(", ")}`);
  console.error(`   seats:  ${seats}`);
  console.error(`   过期:   ${expDate}`);
  console.error(`   nonce:  ${payload.nonce}`);
  console.error("");
  // token 走 stdout，便于管道
  process.stdout.write(token + "\n");
}

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const args = parseArgs(argv.slice(1));

  switch (cmd) {
    case "keygen":
      keygen(args);
      break;
    case "issue":
      issue(args);
      break;
    default:
      console.error("用法:");
      console.error("  node scripts/license/cli.js keygen [--force]");
      console.error(
        '  node scripts/license/cli.js issue --sub "<客户>" --days <天数> [--skills a,b|*] [--seats 1] [--out <path>]',
      );
      process.exit(1);
  }
}

main();
