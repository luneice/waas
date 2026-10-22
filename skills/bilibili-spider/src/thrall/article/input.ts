import { InvalidParamsError } from "@spider/core";
import type { BiliArticleParams } from "@src/types/article.types";

/**
 * 专栏入口解析 —— direct 单一入口（opus URL / cv URL / opusId / cvId / 简写 id）。
 */

export interface DirectArticleInput {
  mode: "direct";
  input: string;
  opusId?: string;
  cvId?: string;
}

export type ResolvedArticleInput = DirectArticleInput;

const OPUS_RE = /opus\/(\d+)/i;
const CV_RE = /cv(\d+)/i;
/** opus 主键是长数字串（实测 19 位）；用 >=16 位区分于 cv 号。 */
const OPUS_ID_MIN_DIGITS = 16;

const SCOPE = "bili-article";

export function resolveArticleInput(
  params: BiliArticleParams,
): ResolvedArticleInput {
  // 显式 opusId / cvId 优先
  const explicitOpus = cleanDigits(params.opusId);
  if (explicitOpus) {
    return { mode: "direct", input: explicitOpus, opusId: explicitOpus };
  }
  const explicitCv = cleanDigits(params.cvId);
  if (explicitCv) {
    return { mode: "direct", input: `cv${explicitCv}`, cvId: explicitCv };
  }

  // url / id 简写
  const directInput = firstNonBlank(params.url, params.id);
  if (!directInput) {
    throw new InvalidParamsError(
      "需要传入 url/opusId/cvId/id 指定要提取的专栏",
      { scope: SCOPE },
    );
  }
  const ids = extractIds(directInput);
  if (!ids.opusId && !ids.cvId) {
    throw new InvalidParamsError(
      "无法从输入解析专栏 ID：需要 /opus/{id}、/read/cv{id}、opusId 或 cv 号",
      { scope: SCOPE, details: { input: directInput } },
    );
  }
  return { mode: "direct", input: directInput, ...ids };
}

function extractIds(input: string): { opusId?: string; cvId?: string } {
  const opusMatch = input.match(OPUS_RE);
  if (opusMatch) return { opusId: opusMatch[1] };

  const cvMatch = input.match(CV_RE);
  if (cvMatch) return { cvId: cvMatch[1] };

  // 纯数字：按长度区分 opus（长串）与 cv（短串）
  if (/^\d+$/.test(input)) {
    return input.length >= OPUS_ID_MIN_DIGITS
      ? { opusId: input }
      : { cvId: input };
  }
  return {};
}

function cleanDigits(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  const match = text.match(/(\d+)/);
  return match ? match[1] : undefined;
}

function firstNonBlank(...values: unknown[]): string | null {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}
