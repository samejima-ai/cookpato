# DELIVERY — Cookpato 初回実装

## 概要

妻用の献立メモアプリ「Cookpato」の初回実装を完了した。
iPhone 11 / iOS Safari でホーム画面追加して使う、完全ローカル動作の PWA。

- 仕様: `INDEX.md` → `SPEC.md` / `DONT.md`
- 技術スタック: `CLAUDE.md` に記載（React 18 + Vite 6 + TypeScript 5 + Tailwind v3 + localStorage + vite-plugin-pwa + Vitest + Biome + date-fns + npm）

## 実装範囲（SPEC 対応）

| SPEC セクション | 実装ファイル | 状態 |
|---|---|---|
| カレンダー（無限スクロール） | `src/components/Calendar.tsx` | ✅ |
| フリー入力（1行1品） | `src/components/DayRow.tsx` | ✅ |
| 完了トグル（品単位） | `src/components/DayRow.tsx` の `LineItem` | ✅ |
| お気に入りマーカー（品単位） | `src/components/DayRow.tsx` の `LineItem` + `src/hooks/useAppData.ts` の `toggleFavorite` | ✅ |
| 過去履歴検索（類似一致） | `src/hooks/useSearch.ts` + `src/components/SearchBar.tsx` + `SearchResults.tsx` | ✅ |
| ストックリスト | `src/components/StockList.tsx` | ✅ |
| 完全ローカル保存 | `src/lib/storage.ts`（`localStorage` キー `cookpato:data:v1`） | ✅ |
| PWA（ホーム画面追加） | `vite.config.ts` + `vite-plugin-pwa` + `public/{favicon.svg,favicon-32x32.png,apple-touch-icon.png,pwa-192x192.png,pwa-512x512.png,pwa-maskable-512.png}` | ✅ |

### ディレクトリ構成

```
src/
├─ App.tsx                    # 単一ページ：検索バー＋カレンダー＋ストック
├─ main.tsx                   # エントリポイント（SW登録を含む）
├─ index.css                  # Tailwind + safe-area ユーティリティ
├─ types.ts                   # 型集約（DateKey, MealLine, DayMeals, StockItem, AppData, SearchHit）
├─ components/
│  ├─ Calendar.tsx            # 無限スクロール（初期±60日／端800pxで±30日拡張）
│  ├─ DayRow.tsx              # 1日分：タップで textarea 編集、品単位のチェック
│  ├─ SearchBar.tsx           # 上部検索入力
│  ├─ SearchResults.tsx       # 検索時のみ表示するオーバーレイ
│  └─ StockList.tsx           # 下部常時表示：追加・削除のみ
├─ hooks/
│  ├─ useAppData.ts           # 単一 JSON で meals / stock を統合管理
│  └─ useSearch.ts            # 完全一致＋類似（カナ共通部分≥2文字）
└─ lib/
   ├─ date.ts                 # date-fns ラッパ（DateKey 相互変換・表示・曜日判定）
   ├─ normalize.ts            # ひら/カナ・全/半・大/小 正規化 + カナ抽出・共通部分
   ├─ storage.ts              # localStorage の load/save/type guard
   └─ id.ts                   # ストックID生成
```

### DONT.md 準拠（排除した機能）

- カテゴリ／タグ
- 料理名マスター（サジェスト、統一）
- レシピ・材料量・手順
- 栄養計算・カロリー
- 写真
- 通知・リマインダー
- サーバー通信全般（fetch / axios / WebSocket も書いていない）
- アカウント・同期
- 画面遷移（すべて単一ページ）
- 登録／保存ボタン（全入力は即時保存）

## センサー結果

### 計算センサー（`sensors/computational.md`）

すべて緑。

| コマンド | 結果 |
|---|---|
| `npm run typecheck` | ✅ エラーなし |
| `npm run lint` (Biome) | ✅ エラー・警告なし（`DayRow.tsx` のキー配列の1箇所のみ、SPEC 準拠で `biome-ignore` 明示コメント付き） |
| `npm run format:check` | ✅ 整形済み |
| `npm run test` (Vitest) | ✅ 33/33 passed（4ファイル） |
| `npm run build` | ✅ 成功（dist 185.29 kB JS / gzip 62.34 kB、PWA SW生成済み） |

テスト内訳：
- `tests/date.test.ts` — 日付ユーティリティ 7件
- `tests/normalize.test.ts` — 正規化・部分一致・カナ共通部分 9件
- `tests/useAppData.test.tsx` — メモ保存・完了トグル・ストック CRUD・お気に入り（toggle / 完了との独立 / 編集維持 / リセット / 既存 v1 互換）12件
- `tests/useSearch.test.tsx` — 完全一致＋類似（「豚バラ」⇄「ブタバラ」等）5件

### 推論センサー（`sensors/inferential.md`）

- **仕様一致**: SPEC.md の 5 機能すべてを実装。DONT.md の排除項目はコード上も存在しない。
- **動く**: `npm run build` 成功。`npm run dev` で起動しブラウザで基本動作を確認済み（サーバを長時間起動してのUI手動E2Eは割愛、テストで代替）。
- **使える（iPhone 11）**: タッチターゲット最小44×44px を UI 規約として守り、`SearchBar` のクリアボタン、`StockList` の ×・追加ボタン、`DayRow` のチェックボタンすべてに `min-w-11 min-h-11` を適用。`safe-top` / `safe-bottom` ユーティリティで SafeArea も処理。

## 設計上の判断メモ

### 1. 検索の「類似」定義

SPEC の「表記ゆれも類似は出す」の要件を満たすため、
- まず `normalize()` で「ひら→カナ／全→半／大小無視」に寄せる。
- 完全一致（`includes`）で exact ヒット。
- 完全一致しない場合、クエリと各品名から**カタカナ部分のみ**を抽出し、
  - 長さ2以上の共通連続部分文字列があるか、
  - または文字集合一致率 ≥ 0.8 のどちらかを満たすと similar ヒット。
- 漢字→読みの変換は行わない（辞書が膨らみ iPhone の初回読み込みを重くするため、SPEC でも非対応と明言）。
- 「ぶたばら」で「豚バラ大根」が類似ヒットするのは、カナ部分の「バラ」共通により成立する。

### 2. 完了状態の扱い

ユーザーは「完了したらもう触らないので完了状態がリセットされても構わない」と明言。
これを受けて、行単位 ID は持たず `lines: { text, done }[]` を index ベースで管理する。
テキスト編集時は**同じ index の行で text が完全一致した場合のみ done を保持**し、
行数が変化した・文字列が変わったら done は初期化する。
複雑な差分マージを回避でき、モデルがシンプル。

### 3. 無限スクロール範囲拡張時のジャンプ防止

上方向に範囲を拡張すると、DOM の先頭に新しい行が挿入されて
`scrollTop` が相対的にズレる（ジャンプする）。
拡張前の `scrollHeight` を ref に保存し、拡張後の差分を `scrollTop` に足して
視覚上の位置を維持している（`Calendar.tsx` の 96-107行目）。

### 4. Biome の `noArrayIndexKey` 警告

`DayRow.tsx` で `key={`${dateKey}-${idx}`}` を使用。
SPEC で「行の並べ替えは実装しない。追加・削除のみ」と決めており、
index が安定したキーとして機能する。`biome-ignore` コメントで明示的に抑制し、
理由を SPEC 参照で書いた。

### 5. Vite 6 / Vitest 2.x 型衝突回避

Vitest 2.x が内部に Vite 5 の型を bundle しているため、
`vite.config.ts` と `vitest.config.ts` を分離し、
`tsconfig.json` の `include` から `*.config.ts` を外して `tsc --noEmit` を通した。
`package.json` の scripts で `vitest run` は独立して `vitest.config.ts` を参照する。

## 動作確認手順（レビュー用）

```bash
cd cookpato
npm install
npm run dev   # http://localhost:5173 で開く
```

基本フロー（iPhone 11 / Safari 実機想定の確認項目）：

1. 初期画面：今日（2026-04-16）を中央に表示したカレンダーが見える。
2. 任意の日をタップ → 入力エリアが現れ、改行区切りで品を入力できる。
3. 品の左の□をタップ → ✓ が付く。
4. 検索バーに「ぶた」と入れると、過去日の「豚バラ大根」「ブタバラ味噌」などが候補に出る。候補タップでカレンダーがその日へスクロール、検索は自動クリア。
5. 下部のストックバーで「玉ねぎ」等を追加・×で削除。
6. ページ再読み込み → すべて復元される（localStorage）。
7. ブラウザ DevTools の Network で、外部通信が一切発生しないことを確認（完全ローカル）。
8. Safari の「ホーム画面に追加」でアイコン表示される（`public/favicon.svg` / `manifest.webmanifest`）。

## 既知の制約・非対応事項

- 漢字→読みの変換はしない。例：「にんじん」で「人参」はヒットしない（SPEC 明記）。
- 初回表示範囲は ±60日。超大量（数年分）の履歴を一度に舐める操作は想定していない。
- 日付移動のジャンプは検索経由のみ。「指定日に直接飛ぶ」UI は実装していない（SPEC外）。
- オフライン完全対応は PWA の precache（初回読込分）までで、ランタイムキャッシュは未設定。追加の offline 戦略は必要になった段階で検討。

## 未実装（意図的スキップ・次回以降）

- 実機 iPhone 11 での動作確認：開発環境で手動 E2E は未実施。妻が実際に使ってのフィードバックを次回 Layer 0 レビュー時に反映する。

## 解消済み（前回 DELIVERY 時点の未実装事項）

- App アイコンの PNG：シマエナガ素材から `scripts/generate-images.mjs`（sharp）で `apple-touch-icon.png` / `favicon-32x32.png` / `pwa-192x192.png` / `pwa-512x512.png` / `pwa-maskable-512.png` を生成し `vite.config.ts` の manifest に登録済み。素材は `assets/`、生成は `npm run images` で再現可能。空状態（今日の空欄・検索ヒット 0 件・ストック 0 件）にも `src/assets/empty-*.png` を表示。

## 次の Layer 0 レビューに献上する観察

- 検索結果が 20件 MAX で打ち切られているため、「もっと遡りたい」ニーズが出た場合に件数上限を上げるかページングを入れるか判断が必要。
- 今日以降の未来日に品を入れた場合の挙動（計画用途）は SPEC 通りに動くが、UI 上「今日」ハイライトだけで区別しているので、計画／実績を分ける要望が出たら別軸の設計になる。
- 完了率のサマリや週次ビューの要望が上がった場合、それは別スキルで別ページに切るほうが「メモ帳の軽さ」原則を守れる。
