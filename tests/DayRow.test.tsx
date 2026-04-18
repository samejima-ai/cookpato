/**
 * DayRow の完了トグル強化（SPEC「完了トグル」改訂）・行削除確認ダイアログ・
 * お気に入りマーカー（正規化キー）のリグレッションテスト。
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DayRow } from "../src/components/DayRow";
import { favoriteKey } from "../src/lib/normalize";
import type { DayMeals } from "../src/types";

const dateKey = "2026-04-15";

function makeDay(lines: { text: string; done?: boolean }[]): DayMeals {
  return {
    lines: lines.map((l) => ({ text: l.text, done: l.done ?? false })),
  };
}

function baseProps() {
  return {
    dateKey,
    day: undefined as DayMeals | undefined,
    isToday: false,
    showCheer: false,
    showWeekComplete: false,
    favoriteKeys: new Set<string>(),
    onTextChange: () => {},
    onToggleLine: () => {},
    onToggleFavorite: () => {},
    onDeleteLine: () => {},
    onMemoChange: () => {},
  };
}

describe("DayRow", () => {
  describe("初期表示", () => {
    it("空日はタップ進入用のトリガー要素を出す（textarea ではない）", () => {
      render(<DayRow {...baseProps()} />);
      const trigger = screen.getByLabelText(/4月15日.*献立を編集/);
      expect(trigger.tagName).toBe("DIV");
      // 献立の textarea は編集モードでのみ出現する（メモの input は常設なので対象外）
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
      // 同フレーム内で 3 連打 → 先頭 1 回だけ通る
      fireEvent.click(toggle);
      fireEvent.click(toggle);
      fireEvent.click(toggle);
      expect(onToggleLine).toHaveBeenCalledTimes(1);
    });
  });

  describe("トグルタップが編集モードに漏れない", () => {
    it("トグルボタンタップは親の編集トリガーへ伝播しない", () => {
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
      expect(onToggleLine).toHaveBeenCalledWith(0);
      // 編集モード進入したら textarea が現れるが、ここでは現れないはず
      expect(
        screen.queryAllByRole("textbox").find((el) => el.tagName === "TEXTAREA"),
      ).toBeUndefined();
    });
  });

  describe("ちょいメモ欄", () => {
    it("memo が空でもメモ入力欄（プレースホルダ「メモ」）が常に表示される", () => {
      render(<DayRow {...baseProps()} />);
      const memo = screen.getByLabelText(/4月15日.*のメモ/);
      expect(memo.tagName).toBe("INPUT");
      expect((memo as HTMLInputElement).placeholder).toBe("メモ");
      expect((memo as HTMLInputElement).value).toBe("");
    });

    it("保存済みの memo が初期値として表示される", () => {
      render(
        <DayRow {...baseProps()} day={{ lines: [{ text: "", done: false }], memo: "遅くなる" }} />,
      );
      const memo = screen.getByLabelText(/4月15日.*のメモ/) as HTMLInputElement;
      expect(memo.value).toBe("遅くなる");
    });

    it("入力のたびに onMemoChange が呼ばれる", () => {
      const onMemoChange = vi.fn();
      render(<DayRow {...baseProps()} onMemoChange={onMemoChange} />);
      const memo = screen.getByLabelText(/4月15日.*のメモ/);
      fireEvent.change(memo, { target: { value: "外食" } });
      expect(onMemoChange).toHaveBeenLastCalledWith("外食");
    });

    it("メモ欄のクリックで料理行の編集モードに入らない", () => {
      render(<DayRow {...baseProps()} />);
      const memo = screen.getByLabelText(/4月15日.*のメモ/);
      fireEvent.click(memo);
      // 料理行の textarea が出ていないこと（メモ入力は input 型だが role=textbox でもヒットする）
      const textboxes = screen.queryAllByRole("textbox");
      // メモ自身は input[type=text] なのでヒットするが、料理行の textarea はヒットしないはず
      expect(textboxes.some((el) => el.tagName === "TEXTAREA")).toBe(false);
    });
  });

  describe("行削除の確認ダイアログ", () => {
    it("✕ タップで確認ダイアログが表示される", () => {
      render(<DayRow {...baseProps()} day={makeDay([{ text: "豚バラ大根" }])} />);
      const del = screen.getByRole("button", { name: /豚バラ大根 を削除/ });
      fireEvent.click(del);
      expect(screen.getByRole("dialog", { name: "行を削除" })).toBeTruthy();
      // ダイアログ内に対象テキストが含まれる
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
      fireEvent.click(screen.getByRole("button", { name: /カレー を削除/ }));
      fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
      expect(onDeleteLine).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("背景（オーバーレイ）タップでキャンセル扱い", () => {
      const onDeleteLine = vi.fn();
      render(
        <DayRow {...baseProps()} day={makeDay([{ text: "カレー" }])} onDeleteLine={onDeleteLine} />,
      );
      fireEvent.click(screen.getByRole("button", { name: /カレー を削除/ }));
      // role=presentation はオーバーレイ自体。
      const overlay = screen.getByRole("dialog").parentElement;
      if (!overlay) throw new Error("overlay not found");
      fireEvent.click(overlay);
      expect(onDeleteLine).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  // 完了行は「静かに後退」させる方針（SPEC「調理中操作の最適化」改訂）。
  // ここは以前の 3 点併用（打ち消し線 + 行背景 + 緑塗り）へのリグレッションを
  // 防ぐのが目的なので、例外的に className を直接検査している。
  describe("完了行の視覚スタイル簡素化", () => {
    it("完了行の料理名に line-through が付かない", () => {
      render(<DayRow {...baseProps()} day={makeDay([{ text: "豚バラ大根", done: true }])} />);
      const toggle = screen.getByRole("button", { name: /未完了に戻す/ });
      const li = toggle.closest("li");
      if (!li) throw new Error("li not found");
      // 料理名を載せる span（block + whitespace-nowrap が付いた可視要素）
      const dishSpan = li.querySelector("div > span.block");
      if (!dishSpan) throw new Error("dish span not found");
      expect(dishSpan.className).not.toMatch(/line-through/);
      expect(dishSpan.className).toMatch(/text-neutral-400/);
    });

    it("完了行の <li> に bg-green-50 が付かない", () => {
      render(<DayRow {...baseProps()} day={makeDay([{ text: "豚バラ大根", done: true }])} />);
      const toggle = screen.getByRole("button", { name: /未完了に戻す/ });
      const li = toggle.closest("li");
      if (!li) throw new Error("li not found");
      expect(li.className).not.toMatch(/bg-green-50/);
    });

    it("完了チェックはグレー塗り（bg-neutral-400）で、緑塗り（bg-green-500）は付かない", () => {
      render(<DayRow {...baseProps()} day={makeDay([{ text: "豚バラ大根", done: true }])} />);
      const toggle = screen.getByRole("button", { name: /未完了に戻す/ });
      const checkbox = toggle.querySelector("span");
      if (!checkbox) throw new Error("checkbox span not found");
      expect(checkbox.className).toMatch(/bg-neutral-400/);
      expect(checkbox.className).toMatch(/border-neutral-400/);
      expect(checkbox.className).not.toMatch(/bg-green-500/);
    });

    it("未完了行のチェックは白地（bg-white）のまま", () => {
      render(<DayRow {...baseProps()} day={makeDay([{ text: "カレー" }])} />);
      const toggle = screen.getByRole("button", { name: /完了にする/ });
      const checkbox = toggle.querySelector("span");
      if (!checkbox) throw new Error("checkbox span not found");
      expect(checkbox.className).toMatch(/bg-white/);
      expect(checkbox.className).not.toMatch(/bg-neutral-400/);
    });
  });
});
