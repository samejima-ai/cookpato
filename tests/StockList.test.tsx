/**
 * StockList の核心 UI フローのリグレッションテスト。
 * - 名前タップ・キーボード（Enter/Space）で編集モード進入
 * - 編集モードでの blur / Enter で updateStockText、Escape でキャンセル
 * - 空文字確定は updateStockText に到達するが no-op（既存テキスト維持）
 * - addStock 用 input は IME 中に親 state を更新せず、blur/Enter で確定する uncontrolled 構造
 *
 * 長押しドラッグの並び替えフローは jsdom では pointer events / setTimeout の組み合わせを
 * フルシミュレートしづらいため、計算層（useAppData の reorderStock）と DELIVERY の実機検証で代替する。
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StockList } from "../src/components/StockList";
import type { AppDataApi } from "../src/hooks/useAppData";
import type { AppData } from "../src/types";

function makeApi(overrides?: Partial<AppDataApi>): AppDataApi {
  const data: AppData = {
    version: 1,
    meals: {},
    stock: [
      { id: "a", text: "下味豚", qty: 3 },
      { id: "b", text: "グラタン", qty: 1 },
    ],
    favorites: [],
    completedWeeks: [],
  };
  return {
    data,
    restoreData: vi.fn(),
    setMealsText: vi.fn(),
    bulkAddEmptyLines: vi.fn(),
    addLineAt: vi.fn(),
    updateLineAt: vi.fn(),
    setMemo: vi.fn(),
    toggleLine: vi.fn(),
    deleteLine: vi.fn(),
    toggleFavorite: vi.fn(),
    toggleCart: vi.fn(),
    addStock: vi.fn(),
    incStock: vi.fn(),
    decStock: vi.fn(),
    removeStock: vi.fn(),
    updateStockText: vi.fn(),
    reorderStock: vi.fn(),
    justCompletedSunday: null,
    clearJustCompleted: vi.fn(),
    beginMealsEdit: vi.fn(),
    commitMealsEdit: vi.fn(),
    ...overrides,
  };
}

describe("StockList", () => {
  describe("開閉トグル（起動時は閉）", () => {
    // アコーディオン本体 wrapper はヘッダーの直後の兄弟要素として描画される
    function getWrapper(): HTMLElement {
      const header = screen.getByRole("button", { name: /ストック/ });
      const wrapper = header.nextElementSibling as HTMLElement | null;
      if (!wrapper) throw new Error("accordion wrapper not found");
      return wrapper;
    }

    it("初期描画でヘッダーが aria-expanded=false、本体 wrapper が aria-hidden=true", () => {
      render(<StockList api={makeApi()} />);
      const header = screen.getByRole("button", { name: /ストック/ });
      expect(header.getAttribute("aria-expanded")).toBe("false");
      expect(getWrapper().getAttribute("aria-hidden")).toBe("true");
    });

    it("初期描画で本体 wrapper は max-h-0 + pointer-events-none で閉じている", () => {
      render(<StockList api={makeApi()} />);
      const wrapper = getWrapper();
      expect(wrapper.className).toMatch(/max-h-0/);
      expect(wrapper.className).toMatch(/pointer-events-none/);
    });

    it("ヘッダータップで開く（aria-expanded=true、wrapper が max-h-96 になる）", () => {
      render(<StockList api={makeApi()} />);
      const header = screen.getByRole("button", { name: /ストック/ });
      fireEvent.click(header);
      expect(header.getAttribute("aria-expanded")).toBe("true");
      const wrapper = getWrapper();
      expect(wrapper.getAttribute("aria-hidden")).toBe("false");
      expect(wrapper.className).toMatch(/max-h-96/);
      expect(wrapper.className).not.toMatch(/pointer-events-none/);
    });

    it("再度タップで閉じる", () => {
      render(<StockList api={makeApi()} />);
      const header = screen.getByRole("button", { name: /ストック/ });
      fireEvent.click(header);
      fireEvent.click(header);
      expect(header.getAttribute("aria-expanded")).toBe("false");
      expect(getWrapper().className).toMatch(/max-h-0/);
    });

    it("ヘッダーのインジケータが ▸（閉）/ ▾（開）で切り替わる", () => {
      render(<StockList api={makeApi()} />);
      const header = screen.getByRole("button", { name: /ストック/ });
      expect(header.textContent).toContain("▸");
      fireEvent.click(header);
      expect(header.textContent).toContain("▾");
    });

    it("閉時は wrapper に inert 属性が付き、内部要素のキーボード Tab フォーカスを止める", () => {
      render(<StockList api={makeApi()} />);
      expect(getWrapper().hasAttribute("inert")).toBe(true);
    });

    it("開時は wrapper に inert 属性が付かない", () => {
      render(<StockList api={makeApi()} />);
      const header = screen.getByRole("button", { name: /ストック/ });
      fireEvent.click(header);
      expect(getWrapper().hasAttribute("inert")).toBe(false);
    });

    it("開いて内部 input にフォーカス中に閉じると、フォーカスはヘッダーへ戻る", () => {
      render(<StockList api={makeApi()} />);
      const header = screen.getByRole("button", { name: /ストック/ });
      fireEvent.click(header);
      // 内部の追加 input にフォーカスを移す
      const addInput = screen.getByLabelText(/^ストック名$/) as HTMLInputElement;
      addInput.focus();
      expect(document.activeElement).toBe(addInput);
      // 閉じる：focus がヘッダーへ戻る
      fireEvent.click(header);
      expect(document.activeElement).toBe(header);
    });
  });

  describe("名前タップで編集モード進入（pointer 経路）", () => {
    it("pointerdown 直後の pointerup（長押し未成立）で編集モードに入り input が現れる", () => {
      const api = makeApi();
      render(<StockList api={api} />);
      const label = screen.getByLabelText(/下味豚（タップで編集、長押しで並び替え）/);
      // pointerdown → 即 pointerup（500ms 経過なし）でタップ扱い
      fireEvent.pointerDown(label, { pointerId: 1, button: 0 });
      fireEvent.pointerUp(label, { pointerId: 1 });
      const input = screen.getByLabelText(/下味豚 の名前を編集/);
      expect(input).toBeTruthy();
      expect(input.tagName).toBe("INPUT");
    });
  });

  describe("名前タップで編集モード進入（キーボード経路）", () => {
    it("名前ラベルは role=button かつ tabIndex=0", () => {
      const api = makeApi();
      render(<StockList api={api} />);
      const label = screen.getByLabelText(/下味豚（タップで編集、長押しで並び替え）/);
      expect(label.getAttribute("role")).toBe("button");
      expect(label.getAttribute("tabindex")).toBe("0");
    });

    it("Enter キーで編集モードに入る", () => {
      const api = makeApi();
      render(<StockList api={api} />);
      const label = screen.getByLabelText(/下味豚（タップで編集、長押しで並び替え）/);
      fireEvent.keyDown(label, { key: "Enter" });
      expect(screen.getByLabelText(/下味豚 の名前を編集/)).toBeTruthy();
    });

    it("Space キーで編集モードに入る", () => {
      const api = makeApi();
      render(<StockList api={api} />);
      const label = screen.getByLabelText(/グラタン（タップで編集、長押しで並び替え）/);
      fireEvent.keyDown(label, { key: " " });
      expect(screen.getByLabelText(/グラタン の名前を編集/)).toBeTruthy();
    });
  });

  describe("編集モードでの確定／キャンセル", () => {
    function enterEdit(text: string) {
      const label = screen.getByLabelText(new RegExp(`${text}（タップで編集、長押しで並び替え）`));
      fireEvent.pointerDown(label, { pointerId: 1, button: 0 });
      fireEvent.pointerUp(label, { pointerId: 1 });
      return screen.getByLabelText(new RegExp(`${text} の名前を編集`)) as HTMLInputElement;
    }

    it("Enter で updateStockText が呼ばれ編集モードを抜ける", () => {
      const api = makeApi();
      render(<StockList api={api} />);
      const input = enterEdit("下味豚");
      fireEvent.change(input, { target: { value: "下味豚（醤油）" } });
      input.value = "下味豚（醤油）";
      fireEvent.keyDown(input, { key: "Enter" });
      expect(api.updateStockText).toHaveBeenCalledWith("a", "下味豚（醤油）");
    });

    it("blur で updateStockText が呼ばれる", () => {
      const api = makeApi();
      render(<StockList api={api} />);
      const input = enterEdit("グラタン");
      fireEvent.change(input, { target: { value: "ホワイトソース" } });
      input.value = "ホワイトソース";
      fireEvent.blur(input);
      expect(api.updateStockText).toHaveBeenCalledWith("b", "ホワイトソース");
    });

    it("Escape でキャンセルされ updateStockText は呼ばれない", () => {
      const api = makeApi();
      render(<StockList api={api} />);
      const input = enterEdit("下味豚");
      fireEvent.change(input, { target: { value: "別名" } });
      input.value = "別名";
      fireEvent.keyDown(input, { key: "Escape" });
      expect(api.updateStockText).not.toHaveBeenCalled();
    });
  });

  describe("追加 input は uncontrolled（IME 中スキップ）", () => {
    it("compositionStart 中の change は addStock を呼ばない（IME 多重入力対策）", () => {
      const api = makeApi();
      render(<StockList api={api} />);
      const addInput = screen.getByLabelText(/^ストック名$/);
      fireEvent.compositionStart(addInput);
      fireEvent.change(addInput, { target: { value: "タ" } });
      // 追加ボタンを押さない限り addStock は走らない
      expect(api.addStock).not.toHaveBeenCalled();
    });

    it("Enter キー（IME 確定後）で addStock が呼ばれる", () => {
      const api = makeApi();
      render(<StockList api={api} />);
      const addInput = screen.getByLabelText(/^ストック名$/) as HTMLInputElement;
      fireEvent.change(addInput, { target: { value: "新規ストック" } });
      addInput.value = "新規ストック";
      fireEvent.keyDown(addInput, { key: "Enter" });
      expect(api.addStock).toHaveBeenCalledWith("新規ストック", 1);
    });
  });

  describe("長押しタイマーの解除漏れ防止", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("名前領域 pointerdown → 領域外 pointerup でも 500ms 後にドラッグモードに入らない", () => {
      const api = makeApi();
      render(<StockList api={api} />);
      const label = screen.getByLabelText(/下味豚（タップで編集、長押しで並び替え）/);
      fireEvent.pointerDown(label, { pointerId: 1, button: 0 });
      // 名前領域でなく document（領域外）で pointerup を発火する。
      // fireEvent.pointerUp は内部で適切なイベントオブジェクトを生成し
      // pointerdown 中に document.addEventListener で登録した cancelOnExternalUp に届く。
      fireEvent.pointerUp(document, { pointerId: 1 });
      // 500ms 経過してもドラッグモードに入らない（タイマーが cancel されているはず）
      act(() => {
        vi.advanceTimersByTime(600);
      });
      // ドラッグ中であれば li に shadow-2xl が付く。付いていないことを確認
      const li = screen.getByLabelText(/下味豚（タップで編集、長押しで並び替え）/).closest("li");
      expect(li?.className).not.toMatch(/shadow-2xl/);
    });
  });
});
