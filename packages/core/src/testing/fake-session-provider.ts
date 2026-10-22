// ============================================================================
// FakeSessionProvider — IBrowserSessionProvider 替身 + RAII 租约平衡断言
// ============================================================================
//
// 除了把 FakePage 包成 PageSession，它还承担一件替身独有的职责：
// **记录 acquire/release 配对**。框架承诺"资源必然释放"（PuppeteerSkill
// 的 finally + release 幂等），这条承诺无法靠输出快照验证 —— 泄漏的表现是
// 长跑进程里 Page 越积越多，单次执行完全正常。assertBalanced() 把它变成
// 每个用例结尾一行断言。
// ============================================================================

import type { Page } from "puppeteer-core";
import type {
  BrowserAcquireOptions,
  IBrowserSessionProvider,
  PageSession,
} from "../browser/interfaces";
import { FakePage } from "./fake-page";

export interface AcquireRecord {
  options?: BrowserAcquireOptions;
  releaseCount: number;
}

export class FakeSessionProvider implements IBrowserSessionProvider {
  /** 每次 acquire 的记录（次序即调用次序） */
  readonly acquisitions: AcquireRecord[] = [];
  /** acquire 抛错（模拟浏览器不可用），值为错误实例工厂 */
  acquireError?: () => Error;

  constructor(readonly page: FakePage = new FakePage()) {}

  async acquire(options?: BrowserAcquireOptions): Promise<PageSession> {
    if (this.acquireError) throw this.acquireError();

    const record: AcquireRecord = { options, releaseCount: 0 };
    this.acquisitions.push(record);

    const page = this.page;
    return {
      page: page as unknown as Page,
      async release() {
        // 幂等：重复 release 只计一次有效释放，多余调用单独计数供断言
        record.releaseCount++;
      },
    };
  }

  async getWSEndpoint(): Promise<string | null> {
    return null;
  }

  /** acquire 次数 */
  get acquireCount(): number {
    return this.acquisitions.length;
  }

  /**
   * 断言每次 acquire 都恰好被 release 过（至少一次）。
   * 正常路径与异常路径都应通过 —— 这是"资源必然释放"承诺的可执行形式。
   */
  assertBalanced(): void {
    const leaked = this.acquisitions
      .map((a, i) => ({ i, n: a.releaseCount }))
      .filter((x) => x.n === 0);
    if (leaked.length > 0) {
      throw new Error(
        `租约未平衡：第 [${leaked.map((l) => l.i).join(", ")}] 次 acquire 未被 release。` +
          `检查 PuppeteerSkill.execute() 的 finally 分支是否被绕过。`,
      );
    }
  }

  /** 重置记录（同一实例跨用例复用时调用） */
  reset(): void {
    this.acquisitions.length = 0;
  }
}
