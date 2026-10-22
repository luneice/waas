/**
 * WS 分帧编解码单测
 *
 * 这是全包最重要的单测之一 —— 拆帧错了，所有 WS 数据都是坏的，而且症状是
 * 「偶发乱码 / 偶发丢消息」，极难定位。
 */
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import {
  encodeFrame,
  encodeMessage,
  encodeHeartbeatEcho,
  isHeartbeat,
  parseFrames,
  decodeMessage,
  decodeMessages,
} from "@src/ws/frame";

describe("encodeFrame —— 长度必须按字节算", () => {
  test("纯 ASCII：字节数 === 字符数", () => {
    assert.equal(encodeFrame("abc"), "~m~3~m~abc");
  });

  test("含中文时按 UTF-8 字节数声明，不是字符数", () => {
    // "中" 在 UTF-8 下占 3 字节；若误用 .length 会声明成 1
    const framed = encodeFrame("中");
    assert.equal(framed, "~m~3~m~中");
    assert.notEqual(framed, "~m~1~m~中", "用字符长度是潜伏 bug");
  });

  test("encodeMessage 序列化后再编帧", () => {
    const f = encodeMessage({ m: "set_locale", p: ["zh-Hans", "CN"] });
    const json = '{"m":"set_locale","p":["zh-Hans","CN"]}';
    assert.equal(f, `~m~${json.length}~m~${json}`);
  });
});

describe("parseFrames —— 粘包与多字节", () => {
  test("一帧多消息（粘包）全部拆出", () => {
    const raw = "~m~10~m~{\"a\":1234}~m~10~m~{\"b\":5678}";
    const chunks = parseFrames(raw);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].text, '{"a":1234}');
    assert.equal(chunks[1].text, '{"b":5678}');
  });

  test("★ 含中文的 payload 不被截断（按分隔符切，不按声明字节数）", () => {
    // 声明的是字节长度 (36)，但 JS 字符串只有 30 个字符。
    // 若按声明数字 slice，就会把后面的内容一起吞进来或截断多字节字符。
    const payload = '{"m":"x","p":["中国银行股份有限公司"]}';
    const raw = encodeFrame(payload);
    const chunks = parseFrames(raw);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].text, payload, "中文 payload 必须完整还原");
    assert.ok(decodeMessage(chunks[0].text) !== null, "还原后必须能 JSON.parse");
  });

  test("中文 payload 粘包也能正确切分", () => {
    const a = '{"m":"a","p":["利率"]}';
    const b = '{"m":"b","p":["逆回购"]}';
    const chunks = parseFrames(encodeFrame(a) + encodeFrame(b));
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].text, a);
    assert.equal(chunks[1].text, b);
  });

  test("心跳帧被识别为 heartbeat 而非 payload", () => {
    const chunks = parseFrames("~m~4~m~~h~1");
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].kind, "heartbeat");
    assert.equal(chunks[0].text, "~h~1");
  });

  test("心跳与业务帧混在同一 TCP 帧里", () => {
    const raw = "~m~4~m~~h~7" + encodeFrame('{"m":"qsd","p":[]}');
    const chunks = parseFrames(raw);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].kind, "heartbeat");
    assert.equal(chunks[1].kind, "payload");
  });

  test("空输入返回空数组，不抛错", () => {
    assert.deepEqual(parseFrames(""), []);
  });
});

describe("心跳回声必须与收到的帧字节一致", () => {
  test("回声帧 === 原始帧", () => {
    for (const seq of ["~h~1", "~h~27", "~h~100"]) {
      const original = encodeFrame(seq);
      assert.equal(encodeHeartbeatEcho(seq), original);
    }
  });

  test("isHeartbeat 只认 ~h~ 前缀", () => {
    assert.equal(isHeartbeat("~h~1"), true);
    assert.equal(isHeartbeat('{"m":"qsd"}'), false);
  });
});

describe("decodeMessage —— 形状校验", () => {
  test("合法 {m,p} 通过", () => {
    const msg = decodeMessage('{"m":"qsd","p":["s1",{}]}');
    assert.equal(msg?.m, "qsd");
    assert.ok(Array.isArray(msg?.p));
  });

  test("非 JSON / 形状不符一律返回 null，不抛异常", () => {
    assert.equal(decodeMessage("not json"), null);
    assert.equal(decodeMessage('{"m":"x"}'), null, "缺 p 应判为形状不符");
    assert.equal(decodeMessage('{"p":[]}'), null, "缺 m 应判为形状不符");
    assert.equal(decodeMessage('"a string"'), null);
    assert.equal(decodeMessage("null"), null);
  });

  test("hello 帧（无 m/p）判为形状不符 —— 由调用方单独处理", () => {
    assert.equal(decodeMessage('{"session_id":"x","protocol":"json"}'), null);
  });
});

describe("decodeMessages —— 批量解码与坏帧重拼兜底", () => {
  test("正常批次全部解出，malformed 为 0", () => {
    const r = decodeMessages(['{"m":"a","p":[]}', '{"m":"b","p":[]}']);
    assert.equal(r.messages.length, 2);
    assert.equal(r.malformed, 0);
  });

  test("被误切成两段的消息可重拼还原", () => {
    // 模拟 payload 内部含 ~m~数字~m~ 字面量导致的误切
    const full = '{"m":"x","p":["~m~5~m~inner"]}';
    const cut = full.indexOf("inner");
    const r = decodeMessages([full.slice(0, cut), full.slice(cut)]);
    assert.equal(r.messages.length, 1, "两段应被重拼成一条消息");
    assert.equal(r.malformed, 0);
    assert.equal(r.messages[0].m, "x");
  });

  test("真正无法解析的片段计入 malformed，不影响其余消息", () => {
    const r = decodeMessages(["@@@garbage@@@", '{"m":"ok","p":[]}']);
    assert.equal(r.messages.length, 1);
    assert.equal(r.messages[0].m, "ok");
    assert.equal(r.malformed, 1);
  });

  test("空批次不抛错", () => {
    const r = decodeMessages([]);
    assert.equal(r.messages.length, 0);
    assert.equal(r.malformed, 0);
  });
});
