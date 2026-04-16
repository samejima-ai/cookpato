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
  };
}

describe("DayRow", () => {
  describe("初期表示", () => {
    it("空日はタップ進入用のトリガー要素を出す（textarea ではない）", () => {
      render(<DayRow {...baseProps()} />);
      const trigger = screen.getByLabelText(/4月15日.*献立を編集/);
      expect(trigger.tagName).toBe("DIV");
      expect(screen.queryByRole("textbox")).toBeNull();
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
      expect(screen.queryByRole("textbox")).toBeNull();
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
});
