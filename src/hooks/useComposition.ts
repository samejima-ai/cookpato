import { useCallback, useRef } from "react";

/**
 * IME（日本語入力）未確定中に onChange で親 state を更新すると、
 * iOS Safari でフリック/トグル入力の文字が「タタタ」のように多重反映され、
 * 削除キーが無反応になる不具合が起きる。
 *
 * 使い方は 2 段構え：
 * 1. compositionStart〜compositionEnd の間は shouldSkipChange() が true を返すので、
 *    onChange 側は親 state 反映をスキップする。
 * 2. compositionEnd 直後の最終確定値は呼び出し側で明示反映し、同時に markCommitted(value)
 *    を呼ぶ。直後に同値の onChange が発火した場合、shouldSkipChange() は 1 回だけ true
 *    を返して二重反映を防ぐ（ブラウザによっては compositionend 後に input/change も続く）。
 */
export function useComposition() {
  const composingRef = useRef(false);
  // compositionEnd で確定反映した値。次の change が同値なら 1 回だけ捨てる。
  const ignoreNextValueRef = useRef<string | null>(null);

  const onCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const onCompositionEnd = useCallback(() => {
    composingRef.current = false;
  }, []);

  const isComposing = useCallback((nativeEvent?: Event): boolean => {
    if (composingRef.current) return true;
    if (nativeEvent && "isComposing" in nativeEvent) {
      return (nativeEvent as InputEvent).isComposing === true;
    }
    return false;
  }, []);

  const markCommitted = useCallback((value: string) => {
    ignoreNextValueRef.current = value;
  }, []);

  const shouldSkipChange = useCallback(
    (nextValue: string, nativeEvent?: Event): boolean => {
      if (isComposing(nativeEvent)) return true;
      if (ignoreNextValueRef.current !== null) {
        if (ignoreNextValueRef.current === nextValue) {
          ignoreNextValueRef.current = null;
          return true;
        }
        // 異なる値が来たら保留をリセット（取りこぼしを防ぐ）
        ignoreNextValueRef.current = null;
      }
      return false;
    },
    [isComposing],
  );

  return {
    onCompositionStart,
    onCompositionEnd,
    isComposing,
    markCommitted,
    shouldSkipChange,
  };
}
