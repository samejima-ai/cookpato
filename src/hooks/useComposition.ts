import { useCallback, useRef } from "react";

/**
 * IME（日本語入力）未確定中に onChange で親 state を更新すると、
 * iOS Safari でフリック/トグル入力の文字が「タタタ」のように多重反映され、
 * 削除キーが無反応になる不具合が起きる。
 * 本 hook は compositionStart から compositionEnd の間 isComposing() を true にし、
 * onChange の値反映をその間スキップするために使う。
 * compositionEnd 直後の最終値は呼び出し側で明示的に反映する。
 */
export function useComposition() {
  const composingRef = useRef(false);

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

  return { onCompositionStart, onCompositionEnd, isComposing };
}
