import { useLayoutEffect, useRef, useState } from "react";

/**
 * 「コンテナ幅に収まらないテキストをフォントサイズ縮小で 1 行に収める」
 * ロジックを共有するための hook。
 *
 * 仕組み：
 * - 呼び出し側が `containerRef`（幅の制約元）と `measureRef`
 *   （basePx で描画した非表示の測定用要素）をそれぞれに付与する
 * - value が変わるたびに `containerRef.clientWidth / measureRef.scrollWidth`
 *   の比で font-size を縮小し、下限は `minPx` で打ち止め
 * - 空文字のときは `emptyPx`（未指定なら basePx）にフォールバック
 *
 * 測定用要素の見た目（italic やフォント等、グリフ幅に効くスタイル）は
 * 呼び出し側の JSX で合わせる必要がある。本 hook は計測値しか扱わない。
 */
export function useAutoShrink(options: {
  value: string;
  basePx: number;
  minPx: number;
  emptyPx?: number;
}) {
  const { value, basePx, minPx, emptyPx = basePx } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fontPx, setFontPx] = useState<number>(value === "" ? emptyPx : basePx);

  useLayoutEffect(() => {
    if (value === "") {
      setFontPx(emptyPx);
      return;
    }
    const c = containerRef.current;
    const m = measureRef.current;
    if (!c || !m) return;
    const cw = c.clientWidth;
    const nw = m.scrollWidth;
    if (cw === 0 || nw === 0) return;
    if (nw <= cw) {
      setFontPx(basePx);
    } else {
      const scaled = Math.max(minPx, Math.floor(basePx * (cw / nw)));
      setFontPx(scaled);
    }
  }, [value, basePx, minPx, emptyPx]);

  return { containerRef, measureRef, fontPx };
}
