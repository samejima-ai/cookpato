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

---

## サイクル履歴

### 2026-05-04: ストック行改修・名前編集・メモバグ修正・長押しドラッグ並び替え（L0 #17 → L1）

L0 サイクル（PR #17、INSTRUCTIONS.md）に従い 4 タスクを実装。

#### 変更点
- **ストック行 1 行収納**：`StockList.tsx` を全面書き換え。`useAutoShrink` で名前を 1 行表示。`[−][個数][＋]` を 36×36px（SPEC「ストックリスト」の 44px 例外）、個数表示を 28×36px に縮小。
- **ストック名編集**：名前タップで `StockNameEditInput`（uncontrolled input）に切替。blur／Enter で確定、Escape でキャンセル、空文字確定は無視（既存名維持）。`useAppData.updateStockText(id, text)` を追加。
- **メモ入力バグ修正**：`MemoField` を controlled（`value`）→ uncontrolled（`defaultValue`）に変更。呼び出し側で `key={dateKey}` を付与し日付切替時に再マウント。iOS Safari の IME 多重入力／入力消失バグを構造的に回避。
- **長押しドラッグ並び替え**：`↑↓` ボタン廃止、`moveStockUp/Down` API 削除。`reorderStock(fromIndex, toIndex)` API 追加。500ms 長押し成立で `dragState` セット、document level の `pointermove` / `pointerup` / `pointercancel` 経由で `toIndex` 追跡＆並び替え確定。`setPointerCapture` は使わない（iOS Safari で document に pointer events が届かなくなるため）。短時間タップ（長押し未成立）は編集モード進入として分岐。Escape／行外タップで解除。
- **ドラッグ中アニメーション**：toIndex 変化のたびに全行が「離した時のレイアウト」へ 150ms ease-out で snap（ドラッグ行も含む）。確定時は FLIP の起点が既に snap 後位置のため自然に着地。
- **キーボード操作**：名前領域に `role="button"` / `tabIndex={0}` / `Enter`・`Space` ハンドラを追加し、編集モード進入をキーボードからも可能にした。
- **ドラッグ中の自動スクロール**：`max-h-48` を超える長いリストでも、指がスクロール容器の上下端 40px 以内にいると自動スクロールする。リスト全体で並び替え可能。

#### センサー結果（全 5 項目 pass）
| コマンド | 結果 |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm run format:check` | ✅ |
| `npm test` | ✅ 131/131（前回 33 件 → 増分 98 件）|
| `npm run build` | ✅（dist 358.54 kB JS / gzip 83.03 kB）|

#### 既知未検証事項
- 実機 iPhone 11 Safari での長押しドラッグ挙動（jsdom では document level の pointer events / touchmove preventDefault / 自動スクロールをフルにはシミュレートしていない）。Vercel Preview デプロイで実機確認推奨。
- メモ入力バグ修正の効果も実機 iOS Safari でフリック入力の再現確認が望ましい。
- 長押し中に指を意図せず大きく動かすとブラウザ側のスクロール判定が先行し `pointercancel` で長押しが死ぬ可能性。`touch-action: pan-y` で縦スクロールを許可している妥協のためで、想定範囲内。

#### 体制事後評価（M1 単体モード）
- 妥当。INSTRUCTIONS.md が機能×条件粒度で確定していたため、自走で完遂できた。
- 独立検証 agent の不在による品質劣化はなし（SPEC との照合は自己検証で十分）。
- L2 発動閾値には依然として遠い（変更ファイル数 4、新規行 +400 程度）。次回サイクルも M1 で問題ない見込み。

---

### 2026-05-05: バックアップ機能（A 層 localStorage 二重化 + B 層 週 1 ファイル書き出し）（L0 #20 → L1）

L0 サイクル（PR #20、SPEC.md「バックアップ（二層構成）」）に従い、消失リスク対策として
バックアップ機能を実装。妻の端末でストック行改修後にデータ消失した実例を受けた対応。

#### 変更点

**A 層（無音・完全自動）**
- `src/lib/storage.ts` を拡張：
  - `cookpato:backup:v1` キーに `{ snapshotDate, data }` 形式でスナップショットを保存
  - `loadSnapshot` / `saveSnapshot` / `maybeUpdateSnapshot`（同日複数起動でも 1 回のみコピー）
  - `loadDataWithRecovery`：プライマリ実質空 + スナップショット有効データ → 自動復元してプライマリへ書き戻し
  - `coerceAppData` を export 化し `parseBackup` から再利用
- `src/hooks/useAppData.ts`：起動時に `loadDataWithRecovery` + `maybeUpdateSnapshot` を呼ぶ。`restoredFromBackup` フラグと `clearRestoredFlag` / `restoreData` を追加
- `src/components/RestoreToast.tsx`：自動復元発火時に 3 秒トースト表示

**B 層（半自動・週 1）**
- `src/lib/backup.ts` 新規作成：
  - `formatISOWeek(date)` → `2026-W18` 形式（date-fns の `getISOWeek` / `getISOWeekYear`）
  - `getBackupFilename(date)` → `cookpato-backup-2026-W18.json`
  - `serializeBackup(data)` → インデント 2 の JSON
  - `parseBackup(jsonText)` → `coerceAppData` で検証 + 「実質空は拒否」（誤適用での全消し防止）
  - `triggerDownload(filename, content)` → `<a download>` 経由（iOS の OS 確認バナーを経由）
  - `shouldShowExportBanner(lastExport, today)` → 7 日経過判定（不正日付は安全側で表示）
- `src/hooks/useBackup.ts` 新規：`showBanner` / `exportNow` / `dismissBanner`（セッション中のみ） / `importFromText`
- `src/components/BackupBanner.tsx`：起動時バナー UI。タップで `exportNow` 発火、× で閉じる（次回起動時に条件を満たせば再表示）

**インポート（復元 UI）**
- `src/components/BackupRestore.tsx`：「バックアップから復元」ボタン → `<input type="file">` → 確認ダイアログ「現在のデータを上書きします。続行しますか？」 → `api.restoreData` で全データ差し替え
- 検証失敗時はインラインエラーメッセージ（`role="alert"`）。成功時は `<output>` で 3 秒成功メッセージ

**統合**
- `src/components/StockList.tsx` に `restoreSlot?: ReactNode` プロップを追加し、展開エリア末尾に描画
- `src/App.tsx`：`useBackup` を呼び、`RestoreToast` / `BackupBanner` を header 内へ、`BackupRestore` を `StockList` の `restoreSlot` へ配置

#### センサー結果（全 5 項目 pass）
| コマンド | 結果 |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm run format:check` | ✅ |
| `npm test` | ✅ 173/173（前回 131 件 → 増分 +42 件 = storage 20 + backup 12 + 既存維持） |
| `npm run build` | ✅（dist 367.84 kB JS / gzip 86.48 kB） |

#### 既知未検証事項
- 実機 iPhone 11 Safari スタンドアロン PWA モードでの `<a download>` 挙動（仕様で「要実機検証」と明記。iOS 16.4+ で改善済みの認識）。Vercel Preview デプロイで妻の端末にて動作確認推奨
- iOS の Files アプリ「ダウンロード」フォルダへ実際に保存されるかは jsdom テストで担保不能
- 自動復元発火の体験フロー（プライマリだけが消えてスナップショットが残るレアケース）は localStorage モックでユニットテスト済みだが、実機での復元再現は次回 L0 レビュー時に妻の端末で観察して反映

#### 体制事後評価（M1 単体モード）
- 妥当。SPEC.md「バックアップ（二層構成）」が機能×条件粒度で完全に確定しており、迷う場面はなかった
- 独立検証 agent の不在による品質劣化はなし（自己検証＋計算センサーで十分捕捉）
- L2 発動閾値には遠い（変更ファイル数 9、新規行 +750 程度）。次回サイクルも M1 で問題ない見込み

---

### 2026-05-17: F007 バックアップ機構クリップボード化 L1 実装（PR #35 INSTRUCTIONS.md → L1）

L0 改修サイクル（PR #34、SPEC.md「バックアップ（クリップボード方式）」）と
L1 申し送り（PR #35、INSTRUCTIONS.md）に従い、9 タスクを実装。

#### 変更点

**Task 1: `src/lib/backup.ts` 縮約**
- 削除：`BACKUP_INTERVAL_DAYS` / `formatISOWeek` / `getBackupFilename` / `triggerDownload` / `shouldShowExportBanner`
- 維持：`serializeBackup` / `parseBackup`（クリップボード書き込みとテキスト復元の両経路で再利用）
- `date-fns` の `differenceInCalendarDays` / `getISOWeek` / `getISOWeekYear` import を撤去

**Task 2: `src/lib/storage.ts` 縮約 + 旧キー即時削除**
- 削除：`LAST_EXPORT_KEY` 定数 / `loadLastExport` / `saveLastExport`
- 追加：`loadData()` 初回呼び出し時に `localStorage.removeItem('cookpato:lastExport:v1')` を idempotent 実行
- SPEC §「データモデル進化」expand-contract プロトコル例外条項に従い、AppData プライマリキーには触らない

**Task 3: `src/hooks/useBackup.ts` 刷新**
- 削除 API：`showBanner` / `lastExport` / `exportFile` / `markExported`
- 新 API：`copyToClipboard(): Promise<"ok" | "fail">` — `navigator.clipboard.writeText(serializeBackup(api.data))` を try/catch
- 維持 API：`importFromText(text): ImportResult`
- 戻り値は `useMemo` で安定化

**Task 4: `src/components/BackupBadge.tsx` 削除**
- ファイルごと削除（`src/components/BackupBadge.tsx`）
- `src/assets/shimaenaga-backup.png` も削除（他参照なし）
- `src/index.css` の `@keyframes shimaenaga-float` / `.animate-shimaenaga-float` / `.animate-shimaenaga-float-paused` / `prefers-reduced-motion` 配下定義を削除
- `shimaenaga-cart.png` は DayRow（買い物マーカー）で使用継続のため維持

**Task 5: `src/components/StockList.tsx` に `copySlot` プロップ追加**
- `restoreSlot` と並列に `copySlot?: React.ReactNode` を追加し、折りたたみ展開時の末尾に描画
- 既存 UI には変更なし

**Task 6: `src/components/Toast.tsx` 新規追加**
- 画面下部に 3 秒滞在 → 自動消去
- `pointer-events: none` で操作阻害なし
- `motion-safe:animate-toast-fade`（150ms フェードイン）+ `prefers-reduced-motion` 配慮
- `kind: "info" | "error"` で色分け（info=neutral-800、error=red-600）
- 新規 CSS keyframe `toast-fade` を `src/index.css` に追加

**Task 7: `src/components/BackupRestore.tsx` 拡張**
- 経路 1（ファイル復元）：既存ロジックを温存、ボタン文言を「バックアップから復元」→ **「ファイルから復元」** に改名（SPEC §「経路 1」定義に合わせる）
- 経路 2（クリップボード貼り付け復元）新規追加：「クリップボードから復元」ボタン → 折りたたみ内 textarea + 「復元」/「キャンセル」ボタン
- 両経路とも：内容を `pendingText` に保持 → `ConfirmRestoreDialog`「現在のデータを上書きします。続行しますか？」→ 確定タップで初めて `importFromText` を呼ぶ（確認前にデータ上書きが起きない順序を明示実装）
- 検証失敗時は現データを変更せずインラインエラー（`role="alert"`）、成功時は `<output>` で 3 秒成功メッセージ

**Task 8: `src/components/BackupCopyButton.tsx` 新規追加 + `src/App.tsx` 配線整理**
- `BackupCopyButton`：折りたたみ内に表示する「バックアップをコピー」ボタン。`onCopy` 結果に応じて `onToast` を呼ぶ
- `App.tsx`：`BackupBadge` import と `showBanner` 分岐を削除、`toast` state + `showToast` / `dismissToast` を追加、`StockList.copySlot` に `BackupCopyButton` を注入、画面下部に `Toast` を配置

**Task 9: テスト更新**
- `tests/backup.test.ts`：旧 API 系（`formatISOWeek` / `getBackupFilename` / `shouldShowExportBanner`）テストを削除、`serializeBackup` / `parseBackup` テストは維持
- `tests/storage.test.ts`：`loadLastExport` / `saveLastExport` テストを削除、新規 3 ケース追加（旧キー削除 / 旧キー不在時の冪等 / AppData プライマリキーへの非影響）
- `tests/useBackup.test.tsx` 新規追加：`copyToClipboard` の成功・失敗 2 ケース（必須、`navigator.clipboard.writeText` を `Object.defineProperty` で差し替え）+ `importFromText` の 3 ケース（成功 / 不正 JSON / 実質空）

#### センサー結果（全 5 項目 pass）
| コマンド | 結果 |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm run format:check` | ✅ |
| `npm test` | ✅ 228/228（前回 229 → backup 旧テスト 5 件削除、storage 旧テスト 2 件削除、storage 新 3 件 + useBackup 新 5 件 = -7 +8 - 1 旧 serializeBackup 統合差分）|
| `npm run build` | ✅（dist 375.18 kB JS / gzip 88.49 kB、BackupBadge 削除分のバンドル減と Toast/BackupCopyButton 追加分のバンドル増で実質中立、`differenceInCalendarDays` 等の date-fns サブモジュールが落ちた）|

#### 既知未検証事項
- **実機 iPhone 11 Safari スタンドアロン PWA モードでの `navigator.clipboard.writeText` 挙動**：user gesture 起源（ボタンタップ）で permission prompt なしで動作するはずだが、iOS 版数による差異あり。失敗時のトースト分岐発火を実機確認推奨
- **textarea への iOS 標準「貼り付け」ジェスチャ**：長押し → 貼り付けメニューが普通に出ることを実機確認推奨
- **トーストの 3 秒滞在 + `pointer-events: none`**：スクロール / タップを阻害しないことを実機確認推奨
- jsdom テストでは `navigator.clipboard` を `Object.defineProperty` で差し替えてシミュレートしているため、ブラウザ実機の Permissions API 経路は別途確認が必要

#### 哲学整合（INDEX.md / CLAUDE.md「早い・簡単・便利」）
- **早い** ✓ — タップ 1 回でコピー完了、OS ダイアログを挟まない
- **簡単** ✓ — シマエナガバッジ催促が消滅、妻に何も求めない設計
- **便利** ✓ — JSON 形式での外部保管経路を維持、ファイル復元との対称運用も成立

#### 体制事後評価（M1 単体モード）
- 妥当。INSTRUCTIONS.md（PR #35）が機能×タスク粒度で完全に確定しており、迷う場面はなかった
- 独立検証 agent の不在による品質劣化はなし（自己検証＋計算センサーで十分捕捉、Copilot レビューも L0 段階で 5 件取り込み済）
- L2 発動閾値には遠い（変更ファイル数 9、新規行 +400 程度、削除 +200 程度）。次回サイクルも M1 で問題ない見込み
