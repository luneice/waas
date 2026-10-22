// ============================================================================
// License 类型定义
// ============================================================================

/** License 载荷（被 RSA 签名的内容） */
export interface LicensePayload {
  /** 客户标识（公司名 / 邮箱 / 内部编号） */
  sub: string;
  /** 授权的 skill 白名单；["*"] 表示全部 */
  skills: string[];
  /** 签发时间（Unix 秒） */
  iat: number;
  /** 过期时间（Unix 秒）；过期后整体不可用 */
  exp: number;
  /** 允许绑定的机器数（TOFU 锁定上限），默认 1 */
  seats?: number;
  /** 唯一编号，便于追溯 */
  nonce?: string;
}

/** 校验失败原因（细分，便于给用户清晰提示） */
export type LicenseFailureReason =
  | "missing" // 找不到 license
  | "malformed" // 格式损坏
  | "bad-signature" // 验签失败
  | "expired" // 已过期
  | "skill-not-licensed" // 当前 skill 不在白名单
  | "machine-mismatch" // 机器指纹不匹配（换机 / 超出 seats）
  | "integrity-failed" // 产物自身完整性校验失败（L1）
  | "tampered"; // 内部一致性检查失败（L4 冗余点）

export interface LicenseVerifyOk {
  ok: true;
  payload: LicensePayload;
}

export interface LicenseVerifyFail {
  ok: false;
  reason: LicenseFailureReason;
  message: string;
}

export type LicenseVerifyResult = LicenseVerifyOk | LicenseVerifyFail;
