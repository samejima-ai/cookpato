/**
 * シマエナガ素材から PWA アイコン・空状態イラスト・お気に入りアイコンを生成。
 * 入力: assets/*.png（透過 PNG）
 * 出力: public/*.png（PWA 用、白背景）, src/assets/*.png（UI 用、透過維持）
 *
 * 実行: npm run images
 * 生成物は Git にコミットする（PWA ビルドに必要、再現性は本スクリプトで保証）
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ASSETS = resolve(ROOT, "assets");
const PUBLIC = resolve(ROOT, "public");
const SRC_ASSETS = resolve(ROOT, "src/assets");

mkdirSync(PUBLIC, { recursive: true });
mkdirSync(SRC_ASSETS, { recursive: true });

/**
 * 正方形クロップ → 余白付き → 背景白でフラット化 → 指定サイズ
 */
async function makeIcon(input, output, size, paddingRatio = 0.1) {
  const src = sharp(resolve(ASSETS, input));
  const meta = await src.metadata();
  const dim = Math.min(meta.width, meta.height);
  // 中央の正方形を切り出す
  const left = Math.floor((meta.width - dim) / 2);
  const top = Math.floor((meta.height - dim) / 2);

  const inner = Math.round(size * (1 - paddingRatio * 2));
  const margin = Math.round((size - inner) / 2);

  const cropped = await src
    .extract({ left, top, width: dim, height: dim })
    .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: cropped, top: margin, left: margin }])
    .png()
    .toFile(resolve(PUBLIC, output));

  console.info(`✓ ${output} (${size}x${size})`);
}

/**
 * 透過維持で縮小のみ（UI 用イラスト・アイコン）
 */
async function makeTransparent(input, output, size) {
  await sharp(resolve(ASSETS, input))
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(resolve(SRC_ASSETS, output));

  console.info(`✓ src/assets/${output} (${size}x${size})`);
}

async function main() {
  // PWA アイコン（sushimaenaga = 食べ物アプリのアイデンティティ）
  await makeIcon("sushimaenaga.png", "pwa-192x192.png", 192, 0.1);
  await makeIcon("sushimaenaga.png", "pwa-512x512.png", 512, 0.1);
  await makeIcon("sushimaenaga.png", "apple-touch-icon.png", 180, 0.1);
  await makeIcon("sushimaenaga.png", "favicon-32x32.png", 32, 0.05);
  // maskable は安全領域確保のため余白厚め
  await makeIcon("sushimaenaga.png", "pwa-maskable-512.png", 512, 0.2);

  // 空状態イラスト（透過 PNG、Retina 想定で 2x 相当のサイズ）
  await makeTransparent("shimaenaga-cheer.png", "empty-day.png", 240);
  await makeTransparent("shimaenaga2.png", "empty-stock.png", 240);
  await makeTransparent("ocha-shimaenaga.png", "empty-search.png", 200);

  // お気に入りアイコン（行内表示用、表示は CSS で 24px に縮小）
  await makeTransparent("shimaenaga-heart.png", "favorite.png", 80);

  // 週達成時の演出オーバーレイ（満タン遷移時に中央に出る「頑張ったね」）。
  // 画面短辺（iPhone 論理 390-430px 想定）× DPR 3 = 1290px を超えるよう 1600 で出す。
  // 元画像 2048x2048 正方形 → 縮小のみ（劣化なし）。object-contain で中央表示。
  await makeTransparent("shimaenaga-ganbattane.png", "week-complete.png", 1600);
  // 週達成の常駐マーカー（満タン週の日曜行、CSS で小さく表示）
  await makeTransparent("shimaenaga-kinnmedaru.png", "week-medal.png", 80);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
