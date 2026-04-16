/**
 * 触覚フィードバックのラッパー。
 * 完了トグル等、調理中の片手操作で「タップが効いた」感を返すために使う。
 *
 * - Android Chrome 等：navigator.vibrate を使用
 * - iOS Safari（PWA含む）：標準APIなし。silent no-op で問題なし
 *   （SPEC.md「触覚API非対応端末では発火しなくてよい」）
 */
export function tapFeedback(): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(10);
  } catch {
    // 失敗は黙って無視（許可拒否や非対応で投げる場合がある）
  }
}
