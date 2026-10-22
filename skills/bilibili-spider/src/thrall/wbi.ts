import { createHash, randomBytes } from "node:crypto";

export type WbiParamValue = string | number | boolean | null | undefined;
export type WbiParams = Record<string, WbiParamValue>;

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32,
  15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19,
  29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63,
  57, 62, 11, 36, 20, 34, 44, 52,
];

export interface WbiKeys {
  imgKey: string;
  subKey: string;
}

export function extractWbiKey(url: string): string {
  const filename = new URL(url).pathname.split("/").pop() ?? "";
  return filename.split(".")[0] ?? "";
}

export function getMixinKey(imgKey: string, subKey: string): string {
  const rawKey = imgKey + subKey;
  return MIXIN_KEY_ENC_TAB.map((i) => rawKey[i]).join("").slice(0, 32);
}

export function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

export function signWbiParams(
  params: WbiParams,
  keys: WbiKeys,
  nowSeconds = Math.round(Date.now() / 1000),
): Record<string, string | number | boolean> {
  const mixinKey = getMixinKey(keys.imgKey, keys.subKey);
  const signedParams: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries({ ...params, wts: nowSeconds })) {
    if (value === undefined || value === null) continue;
    if (key === "w_rid") continue;
    signedParams[key] = value;
  }

  const query = Object.keys(signedParams)
    .sort()
    .map((key) => {
      const value = String(signedParams[key]).replace(/[!'()*]/g, "");
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join("&");

  return {
    ...signedParams,
    w_rid: md5(query + mixinKey),
  };
}

export function generateQvId(): string {
  const alphabet =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = randomBytes(32);
  let out = "";
  for (const b of bytes) {
    out += alphabet[b % alphabet.length];
  }
  return out;
}
