// ============================================================================
// invokeNormalize / invokeValidate — 把 protected 校验面暴露给 L1 测试
// ============================================================================
//
// normalizeParams 是全仓最该单测的东西之一（trim/clamp、`??` 默认值、
// 降级对齐、`MissingContextError` vs `InvalidParamsError` 的区分），但它是
// protected —— 直接调用要在**每个用例**写 `(skill as any).normalizeParams(p)`。
// 那样做有两处代价：`as any` 会把参数与返回值的类型收窄一起丢掉，拼错方法名
// 也要到运行时才炸。这里收成一个有类型的入口，`as` 只出现一次。
//
// 不把它做成"顺便也跑 schema 校验"的复合函数：normalizeParams 与
// validateWithSchema 是**两个独立契约**（前者语义、后者结构），测试要能
// 分别断言各自的错误 kind。需要连跑的场景用 invokeNormalizeAndValidate。
// ============================================================================

import type { ISkill } from "../skill/interfaces";

interface ProtectedSkillFace<P extends object> {
  normalizeParams(params: P): P;
  validateWithSchema(params: P): void;
}

function faceOf<P extends object>(skill: object): ProtectedSkillFace<P> {
  const face = skill as unknown as Partial<ProtectedSkillFace<P>>;
  if (typeof face.normalizeParams !== "function") {
    throw new Error(
      "invokeNormalize: 目标对象没有 normalizeParams —— 它继承自 BaseSkill 吗？",
    );
  }
  return face as ProtectedSkillFace<P>;
}

/**
 * 调用 skill 的 normalizeParams。
 *
 * 语义与框架内一致：只做校验 / trim/clamp / `??` 填默认值，返回全新对象。
 * 抛出的是 SpiderError 子类，用例应断言 `err.kind` 而非 message 文本。
 */
export function invokeNormalize<P extends object>(
  skill: ISkill<P, unknown, unknown> | object,
  params: P,
): P {
  return faceOf<P>(skill).normalizeParams(params);
}

/**
 * 调用 skill 的 validateWithSchema（paramSchema 驱动的必填 / 类型校验）。
 *
 * 注意它会**就地 coerce** 入参对象（"5"→5），与框架内行为一致；
 * 想要断言 coerce 结果就传一个可变对象进来再读它。
 */
export function invokeValidate<P extends object>(
  skill: ISkill<P, unknown, unknown> | object,
  params: P,
): void {
  faceOf<P>(skill).validateWithSchema(params);
}

/**
 * 按框架真实次序连跑：normalizeParams → validateWithSchema。
 * 用于验证"归一化填了默认值，因而 schema 必填校验能过"这类跨两步的语义。
 */
export function invokeNormalizeAndValidate<P extends object>(
  skill: ISkill<P, unknown, unknown> | object,
  params: P,
): P {
  const face = faceOf<P>(skill);
  const normalized = face.normalizeParams(params);
  face.validateWithSchema(normalized);
  return normalized;
}
