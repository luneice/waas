// ============================================================================
// License 校验核心（纯离线）
// ============================================================================
//
// 防护分层：
//   L0  公钥内嵌 + RSA 离线验签（RSA-SHA256）+ exp 过期
//   L1  产物 index.js 自身完整性校验（与构建期记录的 hash 比对）
//   L2  首次运行 TOFU 绑定机器指纹（写入 ~/.spider/.machine-lock）
//   L4  克制型：导出一个内部"放行令牌"，由调用方在多个执行路径冗余校验
//
// 编译期常量（由 scripts/build-skill.js 的 esbuild define 注入；
// 开发态为 undefined，此时跳过对应校验以便本地调试）：
//   __LICENSE_PUBKEY__   RSA 公钥（SPKI PEM 或 base64）
//   __BUILD_INTEGRITY__  本产物 index.js 的 sha256（构建后回填）
//   __BUILD_ID__         本次构建唯一 id
// ============================================================================

import { createPublicKey, createVerify, createHash } from "crypto";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { computeMachineFingerprint } from "./fingerprint";
import type {
  LicensePayload,
  LicenseVerifyResult,
  LicenseFailureReason,
} from "./types";

declare const __LICENSE_PUBKEY__: string | undefined;
declare const __BUILD_ID__: string | undefined;

const PUBKEY: string | undefined =
  typeof __LICENSE_PUBKEY__ === "string" ? __LICENSE_PUBKEY__ : undefined;
const BUILD_ID: string | undefined =
  typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : undefined;

const SPIDER_DIR = path.join(os.homedir(), ".spider");
const LOCK_FILE = path.join(SPIDER_DIR, ".machine-lock");

function fail(
  reason: LicenseFailureReason,
  message: string,
): LicenseVerifyResult {
  return { ok: false, reason, message };
}

// ── License 来源解析（优先级：flag > env > ~/.spider/.env > ~/.spider/license.key）──
function readDotEnvValue(file: string, key: string): string | undefined {
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      if (t.slice(0, eq).trim() !== key) continue;
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      return v || undefined;
    }
  } catch {
    /* file missing -> undefined */
  }
  return undefined;
}

export function resolveLicenseString(flagPath?: string): string | undefined {
  // 1) --license <path>：文件路径，内容为签名串
  if (flagPath) {
    try {
      const v = fs.readFileSync(flagPath, "utf8").trim();
      if (v) return v;
    } catch {
      /* ignore, fall through */
    }
  }
  // 2) 环境变量
  if (process.env.SPIDER_LICENSE && process.env.SPIDER_LICENSE.trim()) {
    return process.env.SPIDER_LICENSE.trim();
  }
  // 3) ~/.spider/.env 中的 SPIDER_LICENSE
  const fromEnvFile = readDotEnvValue(
    path.join(SPIDER_DIR, ".env"),
    "SPIDER_LICENSE",
  );
  if (fromEnvFile) return fromEnvFile;
  // 4) ~/.spider/license.key（纯签名串文件）
  try {
    const v = fs.readFileSync(path.join(SPIDER_DIR, "license.key"), "utf8").trim();
    if (v) return v;
  } catch {
    /* not found */
  }
  return undefined;
}

// ── L0: 验签 ──
function normalizePublicKey(pub: string) {
  const trimmed = pub.trim();
  if (trimmed.includes("BEGIN")) {
    return createPublicKey(trimmed);
  }
  // 视为 base64 编码的 SPKI DER
  return createPublicKey({
    key: Buffer.from(trimmed, "base64"),
    format: "der",
    type: "spki",
  });
}

function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function verifySignature(token: string): LicensePayload | null {
  if (!PUBKEY) {
    // 开发态（未注入公钥）：跳过验签
    try {
      const [p] = token.split(".");
      return JSON.parse(b64urlToBuf(p).toString("utf8")) as LicensePayload;
    } catch {
      return null;
    }
  }
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(Buffer.from(payloadB64, "utf8"));
    verifier.end();
    const ok = verifier.verify(
      normalizePublicKey(PUBKEY),
      b64urlToBuf(sigB64),
    );
    if (!ok) return null;
    return JSON.parse(b64urlToBuf(payloadB64).toString("utf8")) as LicensePayload;
  } catch {
    return null;
  }
}

// ── L1: 产物自身完整性 ──
// 自指 hash 不可能（写 hash 会改变文件 hash），故采用分离签名文件方案：
//   构建期对最终 index.js 算 sha256，写入同目录 index.js.sig（HMAC，密钥源自构建指纹）。
//   运行期重算 index.js 的 hash，并校验 sig 文件的 HMAC。
//   攻击者改 index.js（如删闸门）→ hash 变 → 与 sig 不符；
//   若同时改 sig，则需要 HMAC 密钥（与 BUILD_ID 绑定，且 BUILD_ID 已内联进产物常量，
//   改产物又会破坏 hash），形成相互约束，显著提高破解成本（克制型 L1）。
function selfIntegritySidecar(selfPath: string): string {
  return selfPath + ".sig";
}

function hmacOf(data: Buffer | string): string {
  return createHash("sha256")
    .update("spider-integrity")
    .update(BUILD_ID ?? "dev")
    .update(data)
    .digest("hex");
}

// 校验单个文件与其 .sig sidecar 的 HMAC 是否一致。
function verifyFileSidecar(target: string): boolean {
  const sidecar = selfIntegritySidecar(target);
  if (!fs.existsSync(sidecar)) return false;
  const buf = fs.readFileSync(target);
  const expected = fs.readFileSync(sidecar, "utf8").trim();
  return hmacOf(buf) === expected;
}

// 解析业务主 bundle（index.js）的绝对路径。
// 新正式态由 index.js 的构建期 banner 注入 __SPIDER_SELF__；旧版 loader stub
// 也注入同一变量，因而无需分叉兼容逻辑。直接启动及开发态回退 argv[1]。
function resolveBusinessBundlePath(): string | undefined {
  const fromEnv = process.env.__SPIDER_SELF__;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return process.argv[1] || undefined;
}

function verifySelfIntegrity(): boolean {
  // 开发态（未注入 BUILD_ID）-> 跳过
  if (!BUILD_ID) return true;
  try {
    const self = resolveBusinessBundlePath();
    if (!self) return false;
    // 1) 业务主 bundle 完整性（改 index.js 删闸门 → hash 变 → 失败）。
    if (!verifyFileSidecar(self)) return false;
    // 2) license 核心字节码完整性。
    //    本函数已被编译进 license.jsc；若攻击者替换 license.jsc，
    //    该校验对象随即错位/缺 sig → 失败。license.jsc 与主 bundle 同目录。
    const licenseJsc = path.join(path.dirname(self), "license.jsc");
    if (fs.existsSync(licenseJsc) && !verifyFileSidecar(licenseJsc)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ── L2: TOFU 机器绑定 ──
interface LockRecord {
  nonce?: string;
  seats: number;
  fingerprints: string[];
}

function readLock(): LockRecord | null {
  try {
    return JSON.parse(fs.readFileSync(LOCK_FILE, "utf8")) as LockRecord;
  } catch {
    return null;
  }
}

function writeLock(rec: LockRecord): void {
  try {
    fs.mkdirSync(SPIDER_DIR, { recursive: true });
    fs.writeFileSync(LOCK_FILE, JSON.stringify(rec), { mode: 0o600 });
  } catch {
    /* best-effort */
  }
}

function verifyMachineBinding(payload: LicensePayload): boolean {
  const fp = computeMachineFingerprint();
  const seats = Math.max(1, payload.seats ?? 1);
  const lock = readLock();

  // 锁文件与当前 license 不匹配（换了 license）→ 视为新绑定上下文
  if (!lock || lock.nonce !== payload.nonce) {
    writeLock({ nonce: payload.nonce, seats, fingerprints: [fp] });
    return true;
  }
  if (lock.fingerprints.includes(fp)) return true;
  if (lock.fingerprints.length < seats) {
    lock.fingerprints.push(fp);
    lock.seats = seats;
    writeLock(lock);
    return true;
  }
  // 超出 seats 且非已绑定机器
  return false;
}

// ── 综合校验 ──
export interface VerifyOptions {
  /** 当前 skill 名（来自 CLIOptions.name），用于白名单校验 */
  skillName: string;
  /** --license 文件路径 */
  licensePath?: string;
}

export function verifyLicense(opts: VerifyOptions): LicenseVerifyResult {
  // 开发态（--dev 构建，未注入公钥）：整体跳过校验，便于本地调试。
  // 正式产物 PUBKEY 必为非空，此分支不会命中。
  if (!PUBKEY) {
    return {
      ok: true,
      payload: {
        sub: "dev",
        skills: ["*"],
        iat: 0,
        exp: Number.MAX_SAFE_INTEGER,
        seats: 0,
        nonce: "dev",
      },
    };
  }

  // L1 先行：产物被篡改（如删校验代码）则直接失败
  if (!verifySelfIntegrity()) {
    return fail("integrity-failed", "产物完整性校验失败，疑似被篡改");
  }

  const token = resolveLicenseString(opts.licensePath);
  if (!token) {
    return fail(
      "missing",
      "未找到 License。请将授权码写入 ~/.spider/.env 的 SPIDER_LICENSE=",
    );
  }

  const payload = verifySignature(token);
  if (!payload) {
    return fail("bad-signature", "License 验签失败或格式损坏");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || now >= payload.exp) {
    return fail("expired", "License 已过期，请续期后继续使用");
  }

  const skills = Array.isArray(payload.skills) ? payload.skills : [];
  const licensed =
    skills.includes("*") || skills.includes(opts.skillName);
  if (!licensed) {
    return fail(
      "skill-not-licensed",
      `当前 License 未授权该模块（${opts.skillName}）`,
    );
  }

  if (!verifyMachineBinding(payload)) {
    return fail(
      "machine-mismatch",
      "License 已绑定到其他机器（或超出授权机器数）",
    );
  }

  return { ok: true, payload };
}

// ── L4 克制型：放行令牌 ──
// verifyLicense 通过后生成一个与构建绑定的令牌；
// 调用方在多个执行路径冗余校验该令牌，单点删除闸门不足以放行。
const PASS_SALT = "spider-license-pass";

export function issuePassToken(payload: LicensePayload): string {
  return createHash("sha256")
    .update(PASS_SALT)
    .update(BUILD_ID ?? "dev")
    .update(String(payload.exp))
    .update(payload.nonce ?? "")
    .digest("hex");
}

export function assertPassToken(token: string | undefined): boolean {
  // 开发态（无 BUILD_ID）：仅要求存在非空令牌
  if (!token) return false;
  return /^[0-9a-f]{64}$/.test(token);
}

// ── 便捷闸门：给非 runCLI 的自定义 CLI 使用 ──
// 在自定义 CLI 的 main() 开头调用一次；校验失败时输出结构化 JSON 并退出进程。
// 成功返回放行令牌（调用方可在 execute 处用 assertPassToken 冗余校验，L4）。
export function enforceLicenseOrExit(opts: {
  skillName: string;
  licensePath?: string;
}): string {
  const lic = verifyLicense(opts);
  if (lic.ok === false) {
    process.stdout.write(
      JSON.stringify({
        success: false,
        error: lic.message,
        errorInfo: { kind: "license-invalid", reason: lic.reason },
        metadata: {},
      }) + "\n",
    );
    process.exit(1);
    throw new Error("unreachable");
  }
  return issuePassToken(lic.payload);
}
