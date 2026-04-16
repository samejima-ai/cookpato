/**
 * DayRow の常時 textarea モード（SPEC「フリー入力 / 編集モードの扱い」改訂）と
 * 完了トグル強化（SPEC「完了トグル」改訂）のリグレッションテスト。
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DayRow } from "../src/components/DayRow";
import type { DayMeals } from "../src/types";

const dateKey = "2026-04-15";

function makeDay(lines: { text: string; done?: boolean; favorite?: boolean }[]): DayMeals {
  return {
    lines: lines.map((l) => ({ text: l.text, done: l.done ?? false, favorite: l.favorite })),
  };
}

describe("DayRow", () => {
  describe("alwaysEditable=true（可視範囲付近）", () => {
    it("textarea がタップなしでマウントされる", () => {
      render(
        <DayRow
          dateKey={dateKey}
          day={undefined}
          isToday={false}
          showCheer={false}
          alwaysEditable={true}
          onTextChange={() => {}}
          onToggleLine={() => {}}
          onToggleFavorite={() => {}}
        />,
      );
      // ボタン → textarea 切替なしで textarea が即時存在する
      const textarea = screen.getByLabelText(/4月15日.*献立を入力/);
      expect(textarea.tagName).toBe("TEXTAREA");
    });

    it("入力が即時に親に伝わる（即時保存）", () => {
      const onTextChange = vi.fn();
      render(
        <DayRow
          dateKey={dateKey}
          day={undefined}
          isToday={false}
          showCheer={false}
          alwaysEditable={true}
          onTextChange={onTextChange}
          onToggleLine={() => {}}
          onToggleFavorite={() => {}}
        />,
      );
      const textarea = screen.getByLabelText(/4月15日.*献立を入力/) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: "豚バラ大根" } });
      expect(onTextChange).toHaveBeenCalledWith("豚バラ大根");
    });

    it("既存の品行に対して完了トグルが動作する", () => {
      const onToggleLine = vi.fn();
      render(
        <DayRow
          dateKey={dateKey}
          day={makeDay([{ text: "豚バラ大根" }, { text: "サラダ" }])}
          isToday={false}
          showCheer={false}
          alwaysEditable={true}
          onTextChange={() => {}}
          onToggleLine={onToggleLine}
          onToggleFavorite={() => {}}
        />,
      );
      const toggles = screen.getAllByRole("button", { name: /完了にする/ });
      expect(toggles).toHaveLength(2);
      const firstToggle = toggles[0];
      if (!firstToggle) throw new Error("first toggle not found");
      fireEvent.click(firstToggle);
      expect(onToggleLine).toHaveBeenCalledWith(0);
    });
  });

  describe("alwaysEditable=false（遠方日付）", () => {
    it("初期状態では textarea ではなく編集トリガー領域が見える（タップ進入方式）", () => {
      render(
        <DayRow
          dateKey={dateKey}
          day={makeDay([{ text: "豚バラ大根" }])}
          isToday={false}
          showCheer={false}
          alwaysEditable={false}
          onTextChange={() => {}}
          onToggleLine={() => {}}
          onToggleFavorite={() => {}}
        />,
      );
      // 編集トリガーは div（button ではない：button の入れ子回避）で aria-label を持つ
      const editTrigger = screen.getByLabelText(/4月15日.*献立を編集/);
      expect(editTrigger.tagName).toBe("DIV");
      // textarea はマウントされない
      expect(screen.queryByLabelText(/4月15日.*献立を入力/)).toBeNull();
    });
  });

  describe("完了トグルのチャタリング防止", () => {
    it("300ms 以内の連続タップは 1 回として扱う", () => {
      vi.useFakeTimers();
      const onToggleLine = vi.fn();
      render(
        <DayRow
          dateKey={dateKey}
          day={makeDay([{ text: "豚バラ大根" }])}
          isToday={false}
          showCheer={false}
          alwaysEditable={true}
          onTextChange={() => {}}
          onToggleLine={onToggleLine}
          onToggleFavorite={() => {}}
        />,
      );
      const toggle = screen.getByRole("button", { name: /完了にする/ });
      vi.setSystemTime(new Date("2026-04-15T12:00:00.000Z"));
      fireEvent.click(toggle);
      vi.setSystemTime(new Date("2026-04-15T12:00:00.100Z")); // 100ms 後
      fireEvent.click(toggle);
      expect(onToggleLine).toHaveBeenCalledTimes(1);

      // 300ms 経過後はもう 1 回タップが通る
      vi.setSystemTime(new Date("2026-04-15T12:00:00.500Z"));
      fireEvent.click(toggle);
      expect(onToggleLine).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });
});
