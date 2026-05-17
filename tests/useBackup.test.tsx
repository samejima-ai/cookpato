/**
 * F007 useBackup フックのテスト（2026-05-17 改訂後 — クリップボード方式）。
 * copyToClipboard の成功 / 失敗 2 ケースは L1 完了の必須受け入れ条件
 * （成功 / 失敗でユーザー表示トーストが分岐するため）。
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBackup } from "../src/hooks/useBackup";
import { serializeBackup } from "../src/lib/backup";
import type { AppData } from "../src/types";

type RestoreSpy = ReturnType<typeof vi.fn>;

function makeData(overrides: Partial<AppData> = {}): AppData {
  return {
    version: 1,
    meals: {},
    stock: [],
    favorites: [],
    completedWeeks: [],
    ...overrides,
  };
}

function makeApi(data: AppData, restoreData: RestoreSpy) {
  // useBackup は AppDataApi の `data` と `restoreData` だけ参照する
  return {
    data,
    restoreData,
  } as unknown as Parameters<typeof useBackup>[0];
}

describe("useBackup.copyToClipboard", () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    // jsdom の navigator.clipboard は read-only descriptor のため defineProperty で差し替える
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn() },
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        configurable: true,
      });
    }
  });

  it("成功時: writeText に serializeBackup(api.data) が渡され、戻り値が 'ok'", async () => {
    const data = makeData({
      stock: [{ id: "a", text: "下味豚", qty: 3 }],
      favorites: ["豚バラ"],
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const { result } = renderHook(() => useBackup(makeApi(data, vi.fn())));
    let copyResult: "ok" | "fail" | undefined;
    await act(async () => {
      copyResult = await result.current.copyToClipboard();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(serializeBackup(data));
    expect(copyResult).toBe("ok");
  });

  it("失敗時: writeText が reject すると戻り値が 'fail' で例外は外に漏れない", async () => {
    const data = makeData({ stock: [{ id: "a", text: "下味豚", qty: 1 }] });
    const writeText = vi.fn().mockRejectedValue(new Error("permission denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const { result } = renderHook(() => useBackup(makeApi(data, vi.fn())));
    let copyResult: "ok" | "fail" | undefined;
    let thrown: unknown = null;
    await act(async () => {
      try {
        copyResult = await result.current.copyToClipboard();
      } catch (e) {
        thrown = e;
      }
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(copyResult).toBe("fail");
    expect(thrown).toBeNull();
  });
});

describe("useBackup.importFromText", () => {
  it("有効な JSON は api.restoreData を呼び ok を返す", () => {
    const restoreData: RestoreSpy = vi.fn();
    const text = serializeBackup(makeData({ stock: [{ id: "a", text: "下味豚", qty: 2 }] }));
    const { result } = renderHook(() => useBackup(makeApi(makeData(), restoreData)));
    const r = result.current.importFromText(text);
    expect(r.ok).toBe(true);
    expect(restoreData).toHaveBeenCalledTimes(1);
  });

  it("不正な JSON は restoreData を呼ばず reason を返す", () => {
    const restoreData: RestoreSpy = vi.fn();
    const { result } = renderHook(() => useBackup(makeApi(makeData(), restoreData)));
    const r = result.current.importFromText("{garbage");
    expect(r.ok).toBe(false);
    expect(restoreData).not.toHaveBeenCalled();
  });

  it("実質空の JSON は拒否（誤適用での全消し防止）", () => {
    const restoreData: RestoreSpy = vi.fn();
    const text = serializeBackup(makeData());
    const { result } = renderHook(() => useBackup(makeApi(makeData(), restoreData)));
    const r = result.current.importFromText(text);
    expect(r.ok).toBe(false);
    expect(restoreData).not.toHaveBeenCalled();
  });
});
