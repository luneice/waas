/**
 * SSE 解码器单测
 *
 * 用例来源：对真实 SSE 服务器的逐字节抓取（od -c 确认），不是凭规范想象。
 * 重点守护「网络分片与事件边界无关」这条 —— 它导致的丢事件/半截 JSON 是偶发的，
 * 线上极难排查。
 */
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { createSseDecoder } from "../../src/stream/sse-decoder";

describe("基本解析", () => {
  test("单个事件：event / data / id 齐全", () => {
    const d = createSseDecoder();
    const evs = d.push('event: tick\nid: 42\ndata: {"a":1}\n\n');
    assert.equal(evs.length, 1);
    assert.deepEqual(evs[0], {
      event: "tick",
      data: '{"a":1}',
      id: "42",
      retry: null,
    });
  });

  test("缺省事件类型为 message（规范默认值）", () => {
    const d = createSseDecoder();
    assert.equal(d.push("data: hello\n\n")[0].event, "message");
  });

  test("一个 chunk 里多个事件全部解出", () => {
    const d = createSseDecoder();
    const evs = d.push("data: a\n\ndata: b\n\ndata: c\n\n");
    assert.deepEqual(evs.map((e) => e.data), ["a", "b", "c"]);
  });
});

describe("★ 跨 chunk 分片重组 —— 本模块存在的理由", () => {
  test("一个事件被拆到两个 chunk", () => {
    const d = createSseDecoder();
    assert.equal(d.push('id: 3\nevent: tick\ndata: {"seq":3,').length, 0, "事件未完成不该派发");
    const second = d.push('"note":"split"}\n\n');
    assert.equal(second.length, 1);
    assert.deepEqual(JSON.parse(second[0].data), { seq: 3, note: "split" });
  });

  test("分片正好切在换行符处", () => {
    const d = createSseDecoder();
    assert.equal(d.push("data: hello\n").length, 0);
    assert.equal(d.push("\n").length, 1, "补上空行才派发");
  });

  test("逐字符喂入也能正确还原（最极端的分片）", () => {
    const d = createSseDecoder();
    const raw = 'event: x\ndata: {"k":"v"}\n\n';
    const out = [];
    for (const ch of raw) out.push(...d.push(ch));
    assert.equal(out.length, 1);
    assert.equal(out[0].data, '{"k":"v"}');
  });

  test("中文被分片切断也不产生乱码", () => {
    const d = createSseDecoder();
    d.push('data: {"note":"中文');
    const evs = d.push('分片测试"}\n\n');
    assert.equal(JSON.parse(evs[0].data).note, "中文分片测试");
  });
});

describe("规范细节（逐条用真实字节验证过）", () => {
  test("多行 data 用 \\n 拼接，不是空格", () => {
    const d = createSseDecoder();
    assert.equal(d.push("data: line1\ndata: line2\n\n")[0].data, "line1\nline2");
  });

  test("冒号后无空格时不吃字符", () => {
    const d = createSseDecoder();
    assert.equal(d.push("data:no-space\n\n")[0].data, "no-space");
  });

  test("冒号后只吃一个空格，多余的保留", () => {
    const d = createSseDecoder();
    assert.equal(d.push("data:   three\n\n")[0].data, "  three");
  });

  test("只有字段名无冒号 → 值为空串", () => {
    const d = createSseDecoder();
    const evs = d.push("data\n\n");
    assert.equal(evs.length, 1);
    assert.equal(evs[0].data, "");
  });

  test("注释行被忽略，且不影响同事件的其它字段", () => {
    const d = createSseDecoder();
    const evs = d.push(": 这是注释\ndata: after\n\n");
    assert.equal(evs[0].data, "after");
  });

  test("★ 纯注释（心跳）不派发事件 —— 否则会污染数据流", () => {
    const d = createSseDecoder();
    assert.equal(d.push(": keep-alive\n\n: keep-alive\n\n").length, 0);
  });

  test("retry 仅数字生效，非数字忽略", () => {
    assert.equal(createSseDecoder().push("retry: 5000\ndata: x\n\n")[0].retry, 5000);
    assert.equal(createSseDecoder().push("retry: abc\ndata: x\n\n")[0].retry, null);
  });

  test("未知字段被忽略，且不会撑出空事件", () => {
    assert.equal(createSseDecoder().push("unknown: whatever\n\n").length, 0);
  });

  test("CRLF 与 CR 行分隔符都能处理", () => {
    assert.equal(createSseDecoder().push("data: crlf\r\n\r\n")[0].data, "crlf");
    assert.equal(createSseDecoder().push("data: cr\r\r")[0].data, "cr");
  });
});

describe("id 与断线续传", () => {
  test("id 跨事件保持（规范：lastEventId 是连接级状态）", () => {
    const d = createSseDecoder();
    assert.equal(d.push("id: 7\ndata: a\n\n")[0].id, "7");
    assert.equal(d.push("data: b\n\n")[0].id, "7", "未重设 id 时应沿用上一个");
    assert.equal(d.lastEventId(), "7");
  });

  test("含 NUL 的 id 按规范忽略（判据是 NUL 不是空格）", () => {
    const d = createSseDecoder();
    // 用 \u0000 转义写 NUL —— 裸 NUL 会让整个文件被 git 判为二进制
    d.push("id: has\u0000nul\ndata: x\n\n");
    assert.equal(d.lastEventId(), null, "含 NUL 的 id 不该被采纳");

    const d2 = createSseDecoder();
    d2.push("id: has space\ndata: x\n\n");
    assert.equal(d2.lastEventId(), "has space", "空格在 id 里是合法字符");
  });
});

describe("flush —— 流结束时的收尾", () => {
  test("最后一个事件没有以空行结尾也能拿到", () => {
    const d = createSseDecoder();
    assert.equal(d.push("data: last\n").length, 0);
    const flushed = d.flush();
    assert.equal(flushed.length, 1);
    assert.equal(flushed[0].data, "last");
  });

  test("缓冲里连换行都没有时也能收尾", () => {
    const d = createSseDecoder();
    d.push("data: no-newline");
    assert.equal(d.flush()[0].data, "no-newline");
  });

  test("干净结束时 flush 不产出多余事件", () => {
    const d = createSseDecoder();
    assert.equal(d.push("data: done\n\n").length, 1);
    assert.equal(d.flush().length, 0, "已派发的事件不该重复产出");
  });
});
