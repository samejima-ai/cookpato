import { useLayoutEffect, useRef, useState } from "react";

/**
 * 「コンテナ幅に収まらないテキストをフォントサイズ縮小で 1 行に収める」
 * ロジックを共有するための hook。
 *
 * 仕組み：
 * - 呼び出し側が `containerRef`（幅の制約元）と `measureRef`
 *   （basePx で描画した非表示の測定用要素）をそれぞれに付与する
 * - `value` 変化時、および `ResizeObserver` が捕捉した `containerRef` の
 *   幅変化時に再計測し、`clientWidth / scrollWidth` の比で font-size を
 *   縮小する（下限は `minPx`）
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
    const measure = () => {
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
    };

    measure();

    // コンテナ幅の動的変化（画面回転・アドレスバー伸縮・兄弟追加等）にも追従。
    // 未対応環境（jsdom など）では feature detect で no-op にする。
    const c = containerRef.current;
    if (!c || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(c);
    return () => ro.disconnect();
  }, [value, basePx, minPx, emptyPx]);

  return { containerRef, measureRef, fontPx };
}
