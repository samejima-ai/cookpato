/**
 * DayRow のリグレッションテスト（F011 フロート入力フォーム導入後）。
 * textarea ベースの編集モードは撤去され、行・メモのタップは親へ通知される。
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DayRow } from "../src/components/DayRow";
import { favoriteKey } from "../src/lib/normalize";
import type { DayMeals } from "../src/types";

const dateKey = "2026-04-15";

function makeDay(lines: { text: string; done?: boolean }[]): DayMeals {
  return {
    lines: lines.map((l) => ({ text: l.text, done: l.done ?? false })),
  };
}

function emptyLines(count: number): DayMeals {
  return {
    lines: Array.from({ length: count }, () => ({ text: "", done: false })),
  };
}

/**
 * 料理名エリアを長押しして「削除モード（ぷるぷる）」に突入させる。
 * fake timers 必須（呼び出し側の describe で `vi.useFakeTimers()` 済みを前提）。
 */
function longPressDish(text: string): void {
  const dishSpan = screen.getByText(text, { selector: "span.block" });
  const dishArea = dishSpan.parentElement;
  if (!dishArea) throw new Error("dish area not found");
  fireEvent.mouseDown(dishArea);
  act(() => {
    vi.advanceTimersByTime(500);
  });
  fireEvent.mouseUp(dishArea);
}

function baseProps() {
  return {
    dateKey,
    day: undefined as DayMeals | undefined,
    isToday: false,
    showCheer: false,
    canInput: false,
    favoriteKeys: new Set<string>(),
    editingLineIndex: null as number | null,
    isMemoEditing: false,
    isSwapSource: false,
    isSwapTarget: false,
    isSwapFlash: false,
    onToggleLine: () => {},
    onToggleFavorite: () => {},
    onToggleCart: () => {},
    onDeleteLine: () => {},
    onInsertLineAt: (_i: number, _w: "above" | "below") => {},
    onExpandEmptyDay: () => {},
    onRequestEditLine: () => {},
    onRequestEditMemo: () => {},
    onLineWobbleEnter: () => {},
    onLongPressDate: () => {},
    onTapDate: () => {},
  };
}

describe("DayRow", () => {
  describe("初期表示", () => {
    it("空日（day undefined）でも描画でき textarea は存在しない", () => {
      render(<DayRow {...baseProps()} />);
      // 新モデルでは textarea は存在しない（FloatingEditor 移行）
      expect(
        screen.queryAllByRole("textbox").find((el) => el.tagName === "TEXTAREA"),
      ).toBeUndefined();
    });

    it("お気に入りキーが favoriteKeys に含まれる行はハートが立つ", () => {
      render(
        <DayRow
          {...baseProps()}
          day={makeDay([{ text: "豚バラ大根" }, { text: "サラダ" }])}
          favoriteKeys={new Set([favoriteKey("豚バラ大根")])}
        />,
      );
      const favoriteButtons = screen.getAllByRole("button", { name: /お気に入り/ });
      expect(favoriteButtons[0]?.getAttribute("aria-pressed")).toBe("true");
      expect(favoriteButtons[1]?.getAttribute("aria-pressed")).toBe("false");
    });
  });

  describe("買い物マーカー（行ごとの手動マーキング）", () => {
    it("cart=true の行はマーカーが立つ（aria-pressed）", () => {
      render(
        <DayRow
          {...baseProps()}
          day={{
            lines: [
              { text: "豚バラ大根", done: false, cart: true },
              { text: "サラダ", done: false },
            ],
          }}
        />,
      );
      const cartButtons = screen.getAllByRole("button", { name: /買い物マーク/ });
      expect(cartButtons[0]?.getAttribute("aria-pressed")).toBe("true");
      expect(cartButtons[1]?.getAttribute("aria-pressed")).toBe("false");
    });

    it("買い物マーカーボタンタップで onToggleCart(idx) が呼ばれる", () => {
      const onToggleCart = vi.fn();
      render(
        <DayRow
          {...baseProps()}
          day={makeDay([{ text: "豚バラ大根" }, { text: "サラダ" }])}
          onToggleCart={onToggleCart}
        />,
      );
      const cartButtons = screen.getAllByRole("button", { name: /買い物マーク/ });
      fireEvent.click(cartButtons[1] as HTMLElement);
      expect(onToggleCart).toHaveBeenCalledWith(1);
    });
  });

  describe("完了トグルのチャタリング防止", () => {
    it("連続タップは 1 回として扱う（デバウンスロック）", () => {
      const onToggleLine = vi.fn();
      render(
        <DayRow
          {...baseProps()}
          day={makeDay([{ text: "豚バラ大根" }])}
          onToggleLine={onToggleLine}
        />,
      );
      const toggle = screen.getByRole("button", { name: /完了にする/ });
      fireEvent.click(toggle);
      fireEvent.click(toggle);
      fireEvent.click(toggle);
      expect(onToggleLine).toHaveBeenCalledTimes(1);
    });
  });

  describe("行タップ → FloatingEditor 起動の通知", () => {
    it("料理行のテキスト領域タップで onRequestEditLine(idx) が呼ばれる", () => {
      const onRequestEditLine = vi.fn();
      render(
        <DayRow
          {...baseProps()}
          day={makeDay([{ text: "カレー" }, { text: "サラダ" }])}
          onRequestEditLine={onRequestEditLine}
        />,
      );
      const textAreas = screen.getAllByLabelText(/タップで編集、長押しで削除モード/);
      fireEvent.click(textAreas[1] as HTMLElement);
      expect(onRequestEditLine).toHaveBeenCalledWith(1);
    });

    it("メモ欄タップで onRequestEditMemo が呼ばれる", () => {
      const onRequestEditMemo = vi.fn();
      render(<DayRow {...baseProps()} onRequestEditMemo={onRequestEditMemo} />);
      const memo = screen.getByLabelText(/4月15日.*のメモ/);
      fireEvent.click(memo);
      expect(onRequestEditMemo).toHaveBeenCalled();
    });

    it("メモが空でも欄は描画され、プレースホルダ「メモ」が表示される", () => {
      render(<DayRow {...baseProps()} />);
      const memo = screen.getByLabelText(/4月15日.*のメモ（未入力）/);
      expect(memo.textContent).toContain("メモ");
    });

    it("空行★行をタップすると onRequestEditLine(idx) が呼ばれる", () => {
      const onRequestEditLine = vi.fn();
      render(
        <DayRow
          {...baseProps()}
          canInput
          day={emptyLines(4)}
          onRequestEditLine={onRequestEditLine}
        />,
      );
      const starItems = screen.getAllByRole("button", { name: /未入力の行/ });
      expect(starItems).toHaveLength(4);
      fireEvent.click(starItems[2] as HTMLElement);
      expect(onRequestEditLine).toHaveBeenCalledWith(2);
    });
  });

  describe("編集中ハイライト（editingLineIndex / isMemoEditing）", () => {
    it("editingLineIndex の行に bg-yellow-50 が付く", () => {
      render(
        <DayRow
          {...baseProps()}
          day={makeDay([{ text: "カレー" }, { text: "サラダ" }])}
          editingLineIndex={0}
        />,
      );
      const toggleButtons = screen.getAllByRole("button", { name: /完了にする/ });
      const li0 = toggleButtons[0]?.closest("li");
      const li1 = toggleButtons[1]?.closest("li");
      expect(li0?.className).toMatch(/bg-yellow-50/);
      expect(li1?.className).not.toMatch(/bg-yellow-50/);
    });

    it("isMemoEditing=true のときメモ欄に bg-yellow-50 が付く", () => {
      render(<DayRow {...baseProps()} isMemoEditing />);
      const memo = screen.getByLabelText(/4月15日.*のメモ/);
      expect(memo.className).toMatch(/bg-yellow-50/);
    });

    it("空行★も editingLineIndex で背景色が付く", () => {
      const { container } = render(
        <DayRow {...baseProps()} canInput day={emptyLines(2)} editingLineIndex={1} />,
      );
      const starItems = container.querySelectorAll("li");
      expect(starItems[0]?.className).not.toMatch(/bg-yellow-50/);
      expect(starItems[1]?.className).toMatch(/bg-yellow-50/);
    });
  });

  describe("空行★プレースホルダ", () => {
    function countStars(container: HTMLElement): number {
      // 新構造: <li><button><span aria-hidden>★</span><span>未入力の行</span></button></li>
      return Array.from(container.querySelectorAll("li span")).filter(
        (el) => el.textContent === "★",
      ).length;
    }

    it("canInput=true の日は空行ごとに★が描画される", () => {
      const { container } = render(<DayRow {...baseProps()} canInput day={emptyLines(4)} />);
      expect(countStars(container)).toBe(4);
    });

    it("canInput=false の日は空行を描画しない", () => {
      const { container } = render(
        <DayRow {...baseProps()} canInput={false} day={emptyLines(4)} />,
      );
      expect(countStars(container)).toBe(0);
    });

    it("1 行入力後の混在状態でも残りの空行に★が継続描画される", () => {
      const day: DayMeals = {
        lines: [
          { text: "カレー", done: false },
          { text: "", done: false },
          { text: "サラダ", done: false },
          { text: "", done: false },
        ],
      };
      const { container } = render(<DayRow {...baseProps()} canInput day={day} />);
      const checkButtons = screen.getAllByRole("button", { name: /完了にする/ });
      expect(checkButtons).toHaveLength(2);
      expect(countStars(container)).toBe(2);
    });

    it("canInput=true かつ行データなし（day=undefined）なら ＋マーク（献立を書く）が描画される", () => {
      // today+7 以降の未来空日：自動 4 空行は入らない。★ ではなく ＋マークを 1 つ出す
      render(<DayRow {...baseProps()} canInput />);
      expect(screen.getByRole("button", { name: /献立を書く/ })).toBeTruthy();
    });

    it("行データなしでは ★（未入力の行）は描画されない（＋マークのみ）", () => {
      const { container } = render(<DayRow {...baseProps()} canInput />);
      expect(countStars(container)).toBe(0);
      expect(screen.queryByRole("button", { name: /未入力の行/ })).toBeNull();
    });

    it("＋マークのタップで onExpandEmptyDay が呼ばれる（★複数行を展開）", () => {
      const onExpandEmptyDay = vi.fn();
      render(<DayRow {...baseProps()} canInput onExpandEmptyDay={onExpandEmptyDay} />);
      fireEvent.click(screen.getByRole("button", { name: /献立を書く/ }));
      expect(onExpandEmptyDay).toHaveBeenCalled();
    });

    it("canInput=false（過去日）かつ行データなしなら ＋マークも出ない", () => {
      render(<DayRow {...baseProps()} canInput={false} />);
      expect(screen.queryByRole("button", { name: /献立を書く/ })).toBeNull();
    });
  });

  describe("シマエナガ装飾（cheer 画像）", () => {
    it("showCheer=true のとき日付列内に cheer 画像が表示される", () => {
      const { container } = render(<DayRow {...baseProps()} showCheer />);
      const cheer = container.querySelector("img.animate-cheer-flip");
      expect(cheer).toBeTruthy();
      const dateColumn = container.querySelector(".w-24");
      expect(dateColumn?.contains(cheer)).toBe(true);
    });

    it("cheer 画像はタップ無効（pointer-events-none）で装飾扱い", () => {
      const { container } = render(<DayRow {...baseProps()} showCheer />);
      const cheer = container.querySelector("img.animate-cheer-flip");
      expect(cheer?.className).toMatch(/pointer-events-none/);
      expect(cheer?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  describe("行末常設「＋追加」ボタンの廃止（2026-05-21）", () => {
    it("行末常設の追加ボタンは描画されない（F013 ↓+ に統合）", () => {
      render(<DayRow {...baseProps()} day={makeDay([{ text: "カレー" }])} />);
      // 「行を追加」aria-label は wobble メニュー内の「の上に行を追加」「の下に行を追加」
      // でのみ使われ、行末の単独ボタンとしては存在しないことを保証する
      expect(screen.queryByRole("button", { name: "行を追加" })).toBeNull();
    });

    it("空日でも行末追加ボタンは描画されない", () => {
      render(<DayRow {...baseProps()} />);
      expect(screen.queryByRole("button", { name: "行を追加" })).toBeNull();
    });
  });

  describe("行削除の確認ダイアログ（長押し → 揺れ → ✕ → ダイアログ）", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("✕ は通常時は表示されず、長押しで現れる", () => {
      render(<DayRow {...baseProps()} day={makeDay([{ text: "豚バラ大根" }])} />);
      expect(screen.queryByRole("button", { name: /豚バラ大根 を削除/ })).toBeNull();
      longPressDish("豚バラ大根");
      expect(screen.getByRole("button", { name: /豚バラ大根 を削除/ })).toBeTruthy();
    });

    it("長押し→✕ タップで確認ダイアログが表示される", () => {
      render(<DayRow {...baseProps()} day={makeDay([{ text: "豚バラ大根" }])} />);
      longPressDish("豚バラ大根");
      const del = screen.getByRole("button", { name: /豚バラ大根 を削除/ });
      fireEvent.click(del);
      expect(screen.getByRole("dialog", { name: "行を削除" })).toBeTruthy();
      expect(screen.getByRole("dialog").textContent).toContain("豚バラ大根");
    });

    it("「削除」ボタンで onDeleteLine(idx) が呼ばれダイアログが閉じる", () => {
      const onDeleteLine = vi.fn();
      render(
        <DayRow
          {...baseProps()}
          day={makeDay([{ text: "豚バラ大根" }, { text: "サラダ" }])}
          onDeleteLine={onDeleteLine}
        />,
      );
      longPressDish("サラダ");
      fireEvent.click(screen.getByRole("button", { name: /サラダ を削除/ }));
      fireEvent.click(screen.getByRole("button", { name: "削除" }));
      expect(onDeleteLine).toHaveBeenCalledWith(1);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("「キャンセル」ボタンでダイアログが閉じ onDeleteLine は呼ばれない", () => {
      const onDeleteLine = vi.fn();
      render(
        <DayRow {...baseProps()} day={makeDay([{ text: "カレー" }])} onDeleteLine={onDeleteLine} />,
      );
      longPressDish("カレー");
      fireEvent.click(screen.getByRole("button", { name: /カレー を削除/ }));
      fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
      expect(onDeleteLine).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("長押しで削除モード（ぷるぷる）", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("長押し中の行に animate-row-wobble が付与される", () => {
      render(<DayRow {...baseProps()} day={makeDay([{ text: "豚バラ大根" }])} />);
      longPressDish("豚バラ大根");
      const toggle = screen.getByRole("button", { name: /完了にする/ });
      const li = toggle.closest("li");
      expect(li?.className).toMatch(/animate-row-wobble/);
    });

    it("ESC キーで削除モードが解除され ✕ が消える", () => {
      render(<DayRow {...baseProps()} day={makeDay([{ text: "豚バラ大根" }])} />);
      longPressDish("豚バラ大根");
      expect(screen.queryByRole("button", { name: /豚バラ大根 を削除/ })).toBeTruthy();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("button", { name: /豚バラ大根 を削除/ })).toBeNull();
    });

    it("500ms 未満で指を離した場合は削除モードに入らない", () => {
      render(<DayRow {...baseProps()} day={makeDay([{ text: "豚バラ大根" }])} />);
      const dishSpan = screen.getByText("豚バラ大根", { selector: "span.block" });
      const dishArea = dishSpan.parentElement;
      if (!dishArea) throw new Error("dish area not found");
      fireEvent.mouseDown(dishArea);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      fireEvent.mouseUp(dishArea);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByRole("button", { name: /豚バラ大根 を削除/ })).toBeNull();
    });

    it("長押し成立後の click は onRequestEditLine を呼ばない（誤発火防止）", () => {
      const onRequestEditLine = vi.fn();
      render(
        <DayRow
          {...baseProps()}
          day={makeDay([{ text: "豚バラ大根" }])}
          onRequestEditLine={onRequestEditLine}
        />,
      );
      longPressDish("豚バラ大根");
      const textArea = screen.getByLabelText(/タップで編集、長押しで削除モード/);
      fireEvent.click(textArea);
      expect(onRequestEditLine).not.toHaveBeenCalled();
    });
  });

  describe("完了行の視覚スタイル簡素化", () => {
    it("完了行の料理名に line-through が付かない", () => {
      render(<DayRow {...baseProps()} day={makeDay([{ text: "豚バラ大根", done: true }])} />);
      const toggle = screen.getByRole("button", { name: /未完了に戻す/ });
      const li = toggle.closest("li");
      const dishSpan = li?.querySelector("div > span.block");
      expect(dishSpan?.className).not.toMatch(/line-through/);
      expect(dishSpan?.className).toMatch(/text-neutral-400/);
    });

    it("完了行の <li> に bg-green-50 が付かない", () => {
      render(<DayRow {...baseProps()} day={makeDay([{ text: "豚バラ大根", done: true }])} />);
      const toggle = screen.getByRole("button", { name: /未完了に戻す/ });
      const li = toggle.closest("li");
      expect(li?.className).not.toMatch(/bg-green-50/);
    });

    it("完了チェックはグレー塗り（bg-neutral-400）で、緑塗りは付かない", () => {
      render(<DayRow {...baseProps()} day={makeDay([{ text: "豚バラ大根", done: true }])} />);
      const toggle = screen.getByRole("button", { name: /未完了に戻す/ });
      const checkbox = toggle.querySelector("span");
      expect(checkbox?.className).toMatch(/bg-neutral-400/);
      expect(checkbox?.className).toMatch(/border-neutral-400/);
    });

    it("未完了行のチェックは白地（bg-white）のまま", () => {
      render(<DayRow {...baseProps()} day={makeDay([{ text: "カレー" }])} />);
      const toggle = screen.getByRole("button", { name: /完了にする/ });
      const checkbox = toggle.querySelector("span");
      expect(checkbox?.className).toMatch(/bg-white/);
    });
  });

  describe("F013 行間挿入（wobble 中の ↑＋／↓＋ ボタン）", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("wobble 中は ↑＋ / ↓＋ / ✕ が表示され、🛒 / ♡ は非表示になる", () => {
      render(<DayRow {...baseProps()} day={makeDay([{ text: "豚バラ大根" }])} />);
      // 通常時：🛒 / ♡ は表示、↑＋ / ↓＋ / ✕ は非表示
      expect(screen.queryByRole("button", { name: /買い物マーク/ })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /お気に入り/ })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /の上に行を追加/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /の下に行を追加/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /を削除/ })).toBeNull();

      longPressDish("豚バラ大根");

      // wobble 中：↑＋ / ↓＋ / ✕ 表示、🛒 / ♡ は非表示
      expect(screen.queryByRole("button", { name: /買い物マーク/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /お気に入り/ })).toBeNull();
      expect(screen.getByRole("button", { name: /豚バラ大根 の上に行を追加/ })).toBeTruthy();
      expect(screen.getByRole("button", { name: /豚バラ大根 の下に行を追加/ })).toBeTruthy();
      expect(screen.getByRole("button", { name: /豚バラ大根 を削除/ })).toBeTruthy();
    });

    it("↑＋ クリックで onInsertLineAt(idx, 'above') が呼ばれる", () => {
      const onInsertLineAt = vi.fn();
      render(
        <DayRow
          {...baseProps()}
          day={makeDay([{ text: "カレー" }, { text: "サラダ" }])}
          onInsertLineAt={onInsertLineAt}
        />,
      );
      longPressDish("サラダ");
      fireEvent.click(screen.getByRole("button", { name: /サラダ の上に行を追加/ }));
      expect(onInsertLineAt).toHaveBeenCalledWith(1, "above");
    });

    it("↓＋ クリックで onInsertLineAt(idx, 'below') が呼ばれる", () => {
      const onInsertLineAt = vi.fn();
      render(
        <DayRow
          {...baseProps()}
          day={makeDay([{ text: "カレー" }, { text: "サラダ" }])}
          onInsertLineAt={onInsertLineAt}
        />,
      );
      longPressDish("カレー");
      fireEvent.click(screen.getByRole("button", { name: /カレー の下に行を追加/ }));
      expect(onInsertLineAt).toHaveBeenCalledWith(0, "below");
    });

    it("空行★（EmptyLineItem）には wobble 進入用の長押し領域がない", () => {
      // 空行は <button aria-label="未入力の行（タップで入力）">。
      // 通常 LineItem の長押し領域とは別構造で、長押しジェスチャは設定されていない。
      const { container } = render(<DayRow {...baseProps()} canInput day={emptyLines(2)} />);
      // 空行を長押ししようとしても、wobble は発生しない（↑＋ ボタンが現れない）
      const stars = container.querySelectorAll(
        "li button[aria-label='未入力の行（タップで入力）']",
      );
      expect(stars.length).toBe(2);
      const target = stars[0] as HTMLElement;
      fireEvent.mouseDown(target);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.mouseUp(target);
      // wobble モードに入らないため、↑＋/↓＋/✕ は描画されない
      expect(screen.queryByRole("button", { name: /の上に行を追加/ })).toBeNull();
    });
  });

  describe("F012 日付ごとスワップ（日付ラベル長押し + 視覚強調）", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("日付ラベルを 500ms 長押しで onLongPressDate が呼ばれる", () => {
      const onLongPressDate = vi.fn();
      render(<DayRow {...baseProps()} onLongPressDate={onLongPressDate} />);
      const dateLabel = screen.getByLabelText(/長押しで日付ごと入れ替え/);
      fireEvent.mouseDown(dateLabel);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.mouseUp(dateLabel);
      expect(onLongPressDate).toHaveBeenCalled();
    });

    it("isSwapSource=true なら日付ラベル領域に bg-blue-50 + ring-2 ring-blue-300 が付く", () => {
      render(<DayRow {...baseProps()} isSwapSource />);
      const dateLabel = screen.getByLabelText(/長押しで日付ごと入れ替え/);
      expect(dateLabel.className).toMatch(/bg-blue-50/);
      expect(dateLabel.className).toMatch(/ring-2/);
      expect(dateLabel.className).toMatch(/ring-blue-300/);
    });

    it("移動モード中の他日（isSwapTarget=true）の日付ラベルタップで onTapDate が呼ばれる", () => {
      const onTapDate = vi.fn();
      render(<DayRow {...baseProps()} isSwapTarget onTapDate={onTapDate} />);
      const dateLabel = screen.getByLabelText(/長押しで日付ごと入れ替え/);
      fireEvent.click(dateLabel);
      expect(onTapDate).toHaveBeenCalled();
    });

    it("移動モード非アクティブ時（isSwapSource=isSwapTarget=false）の日付ラベルタップでは onTapDate は呼ばれない", () => {
      const onTapDate = vi.fn();
      render(<DayRow {...baseProps()} onTapDate={onTapDate} />);
      const dateLabel = screen.getByLabelText(/長押しで日付ごと入れ替え/);
      fireEvent.click(dateLabel);
      expect(onTapDate).not.toHaveBeenCalled();
    });

    it("料理行 wobble 進入時に onLineWobbleEnter が呼ばれる（スワップ移動モード解除トリガー）", () => {
      const onLineWobbleEnter = vi.fn();
      render(
        <DayRow
          {...baseProps()}
          day={makeDay([{ text: "豚バラ大根" }])}
          onLineWobbleEnter={onLineWobbleEnter}
        />,
      );
      longPressDish("豚バラ大根");
      expect(onLineWobbleEnter).toHaveBeenCalled();
    });

    it("isSwapFlash=true なら日付ラベル領域に bg-green-50 が付く", () => {
      render(<DayRow {...baseProps()} isSwapFlash />);
      const dateLabel = screen.getByLabelText(/長押しで日付ごと入れ替え/);
      expect(dateLabel.className).toMatch(/bg-green-50/);
    });
  });
});
