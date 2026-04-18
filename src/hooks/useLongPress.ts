import { useCallback, useEffect, useRef } from "react";

/**
 * 長押し（既定 500ms）を検出してコールバックを発火する hook。
 *
 * 振る舞い：
 * - `onPointerDown` でタイマー開始、`onPointerUp`/`Leave`/`Cancel` で解除
 * - 指定時間保持されたらコールバック発火＋内部フラグを立てる
 * - 直後の `click` はフラグが立っていれば `stopPropagation` する
 *   （長押し→編集モード進入の同時発火を防ぐ）
 *
 * 返り値をそのまま JSX 要素に展開して使う想定：
 * `<div {...useLongPress(fn)}>…</div>`
 */
export function useLongPress(
  callback: () => void,
  ms = 500,
): {
  onMouseDown: () => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  onClick: (e: React.MouseEvent) => void;
} {
  const triggeredRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const start = useCallback(() => {
    triggeredRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true;
      callbackRef.current();
    }, ms);
  }, [ms]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onClick = useCallback((e: React.MouseEvent) => {
    // 長押しが発火していたら、後続の click を親へ伝播させない
    // （tap→編集モード進入との同時発火を回避）
    if (triggeredRef.current) {
      e.stopPropagation();
      triggeredRef.current = false;
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    onClick,
  };
}
