// ============================================================================
// 机器指纹（稳健型，不含 MAC）
// ============================================================================
//
// 设计原则：
//   - 在裸机、虚拟机、容器中尽量稳定，避免 VPN / 换网卡导致误杀
//   - 不使用 MAC 地址（最不稳定）
//   - 指纹 = sha256( hostname + platform + arch + cpuModel + machineId )
//     · machineId 优先取系统级唯一 ID（macOS IOPlatformUUID /
//       Linux /etc/machine-id / Windows MachineGuid）
//     · 取不到时回退到 ~/.spider/.machine 落盘的随机 UUID（首次生成后稳定）
// ============================================================================

import { createHash, randomUUID } from "crypto";
import { execSync } from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";

const SPIDER_DIR = path.join(os.homedir(), ".spider");
const MACHINE_FILE = path.join(SPIDER_DIR, ".machine");

/** 读取系统级 machine id（平台相关，best-effort） */
function readSystemMachineId(): string | null {
  try {
    if (process.platform === "darwin") {
      const out = execSync(
        "ioreg -rd1 -c IOPlatformExpertDevice 2>/dev/null",
        { encoding: "utf8", timeout: 3000 },
      );
      const m = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      return m ? m[1] : null;
    }
    if (process.platform === "linux") {
      for (const p of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
        try {
          const v = fs.readFileSync(p, "utf8").trim();
          if (v) return v;
        } catch {
          /* try next */
        }
      }
      return null;
    }
    if (process.platform === "win32") {
      const out = execSync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
        { encoding: "utf8", timeout: 3000 },
      );
      const m = out.match(/MachineGuid\s+REG_SZ\s+([\w-]+)/i);
      return m ? m[1] : null;
    }
  } catch {
    /* fall through to file fallback */
  }
  return null;
}

/** 回退：在用户目录落盘一个稳定的随机 ID（首次生成，之后复用） */
function readOrCreateFallbackId(): string {
  try {
    if (fs.existsSync(MACHINE_FILE)) {
      const v = fs.readFileSync(MACHINE_FILE, "utf8").trim();
      if (v) return v;
    }
  } catch {
    /* regenerate below */
  }
  const id = randomUUID();
  try {
    fs.mkdirSync(SPIDER_DIR, { recursive: true });
    fs.writeFileSync(MACHINE_FILE, id, { mode: 0o600 });
  } catch {
    /* 即便落盘失败，本次进程内仍返回一个 id（重启后会变，但极端环境兜底） */
  }
  return id;
}

/** 计算本机指纹（稳定的十六进制串） */
export function computeMachineFingerprint(): string {
  const cpus = os.cpus();
  const cpuModel = cpus.length ? cpus[0].model : "unknown-cpu";
  const machineId = readSystemMachineId() ?? readOrCreateFallbackId();
  const raw = [
    os.hostname(),
    process.platform,
    process.arch,
    cpuModel,
    machineId,
  ].join("\u0000");
  return createHash("sha256").update(raw).digest("hex");
}
