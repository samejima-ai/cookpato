# 変更履歴

## 2026-05-17 (LC=1 バックアップ機構クリップボード化 L0 改修サイクル)

### 改訂（F007 バックアップ機構の全面置換）
- SPEC.md「バックアップ」セクション全面書き換え：
  - エクスポート: `<a download>` + 週番号付きファイル名 → `navigator.clipboard.writeText` でクリップボードコピー
  - フィードバック: シマエナガバッジ催促 → コピー成功時のインライントースト「Keep メモやメモ帳に貼り付けて保管してください」3 秒（哲学者の補強案、Council #33。旧「LINE Keep」表記は同サービス終了済のため「Keep メモ」＝LINE 内の自分専用チャットに改めた）
  - 復元 UI: ファイル経路（旧仕様の互換維持）+ クリップボード貼り付け経路（新規、textarea）の 2 経路
  - データモデル進化: localStorage キー `cookpato:lastExport:v1` を即時削除
- INDEX.md 機能一覧の文言を「クリップボードコピー + ファイル/貼り付け復元」に更新
- DONT.md「明示的に行わない通信・同期系」のバックアップ補足を新仕様に更新
- DONT.md「哲学による却下判断」表に Council #33 で却下された 3 案（Web Share / OPFS / 催促 UI 維持）を追加
- history/INTENT.md F007 を改訂版に書き換え、廃止要素を取り消し線で記録、却下案を Council 経緯と合わせて追加

### 廃止（**SPEC レベルの deprecation のみ。コード削除は次サイクル L1**）
本サイクルは L0 のみで、以下は仕様文書上で「廃止」と確定したもの。実装コードの物理削除と `localStorage.removeItem('cookpato:lastExport:v1')` の実行は L1 申し送り項目で次サイクルに行う。
- シマエナガバッジ催促 UI（旧 PR #29-#30 の歩行アニメ含む全機能）— SPEC 削除済、コード削除は L1
- 30 日経過判定（`shouldShowExportBanner` / `lastExport` state）— 仕様削除済、実装撤去は L1
- `<a download>` 経由のファイル書き出し（`triggerDownload` / `getBackupFilename` / ISO 週番号生成）— 仕様削除済、実装撤去は L1
- localStorage キー `cookpato:lastExport:v1` — 仕様廃止確定、`removeItem` 実行は L1

### 体制
- 判定: M1 維持 (S=2, U=0, R=1, N=1)
- 事後評価: 妥当。F007 改訂は機能数の純増なし（既存改訂のみ）、複雑度寄与は限定的
- REGIME-LOG.md 参照

### 儀式記録（本サイクルの振り返り儀式）
- レベル: 2（LC=1、機能改訂を伴う対話）
- スキップ: なし
- 検出件数: 矛盾 0 / 復活要求 0 / 再提案 0
- 動的格上げ／格下げ: なし
- 廃止判断プロトコル発動: シマエナガバッジ催促・`<a download>` 経路の廃止について Council #33（unanimous、judgment_confidence 0.85）で合議＋AI根拠提示が成立済み

### 哲学整合性チェック
- F007 改訂版: 早い ✓（タップ 1 回完結）/ 簡単 ✓（催促なし、妻に何も求めない）/ 便利 ✓（保険経路を維持）
- 採択された案 (Option D) は 3 語すべてに寄与、却下された 3 案はそれぞれ 1 語以上を毀損するため DONT.md 却下表へ記録

### 次サイクル（L1 実装）への申し送り
- `src/lib/backup.ts`: `triggerDownload` / `getBackupFilename` / `formatISOWeek` / `BACKUP_INTERVAL_DAYS` / `shouldShowExportBanner` を削除、`serializeBackup` / `parseBackup` は維持（テキスト操作で再利用）
- `src/hooks/useBackup.ts`: ファイル書き出し系を `navigator.clipboard.writeText` に置換。`lastExport` / `showBanner` / `markExported` API を削除し、`copyToClipboard` / `importFromText` の 2 メソッドに整理
- `src/components/BackupBadge.tsx`: **ファイルごと削除**
- `src/components/BackupRestore.tsx`: ファイル復元経路を維持しつつ「クリップボードから復元」textarea 経路を追加
- `src/components/StockList.tsx`: 折りたたみ内に「バックアップをコピー」ボタンを追加（復元 UI の隣）
- `src/App.tsx`: `<BackupBadge>` の参照と関連 import を削除
- `src/lib/storage.ts`: `loadLastExport` / `saveLastExport` を削除、`cookpato:lastExport:v1` キーは初回読み出し時に存在すれば即時 `localStorage.removeItem` で消去
- トースト UI を新規追加（既存の `BackupRestore` のインラインメッセージと UI 統一推奨）
- テスト: `tests/backup.test.ts` のファイル書き出し系テストを削除、クリップボードコピー / 貼り付け復元 / 旧キー即時削除のテストを追加

---

## 2026-05-17 (LC=1 F012/F013 L1 実装サイクル)

### 追加
- `useAppData` に F012 `swapDays(dateA, dateB)` API を実装
  - lines + memo + done + cart を双方向入れ替え（参照共有を避けるため複製）
  - 両週を再評価し、新規達成週があれば `completedWeeks` に union（F009「献血カウント」セマンティクス維持）
  - 移動元 A の週を優先して `justCompletedSunday` をセット（spec「2 週同時新規達成時は片方のみ発火」）
  - 同日 / 両方完全空 / 未指定日 → no-op
- `useAppData` に F013 `insertLineAt(date, lineIndex, "above" | "below"): number` API を実装
  - 指定位置に空行を 1 つ挿入し、挿入された行の最終 index を返却（呼び出し側が即フロート編集に渡す）
  - 範囲外は内部でクランプ（仕様上は対象行に対して呼ぶ前提）
- `DayRow` 日付ラベル領域に 500ms 長押し検出を追加（`useLongPress` 流用、料理行と同じジェスチャ語彙）
  - 移動元の視覚強調 `bg-blue-50 + ring-2 ring-blue-300`、フラッシュ `bg-green-50`（150ms）
  - 長押し後の click を内部フラグで抑止し `onTapDate` 誤発火を防止
- `DayRow.LineItem` の wobble 中 UI を `[✓][text][↑＋][↓＋][✕]` に置換、🛒/♡ は wobble 中だけ非表示
- `App.tsx` に `swapSource` / `swapFlashDates` state、`handleLongPressDate` / `handleTapDate` / `handleRequestInsertLine` / `handleLineWobbleEnter` ハンドラを実装
  - Escape キー解除を `useEffect` で配線（`swapSource` 非 null 時のみリスナ登録）
  - 任意のフロート編集起動（行・メモ・＋追加・行間挿入）で `setSwapSource(null)` を統合
  - `handleTapDate` は updater 外で副作用を実行（StrictMode 二重実行対策）

### 変更
- `Calendar` の Props に F012/F013 関連 6 件を追加して DayRow へ中継
- `tests/StockList.test.tsx` の `makeApi` モックに `insertLineAt` / `swapDays` を追加（型整合）
- `tests/DayRow.test.tsx` の `baseProps()` を新 props（`isSwapSource` 等 7 件）に拡張

### 廃止
- なし（F004 削除モードは API・データ構造とも互換、wobble 中 UI のみ差し替え）

### 体制
- 判定: M1 維持 (S=2, U=0, R=1, N=1)
- 事後評価: 妥当。M1 で 4 サイクル運用、layer1-independent-reviewer 不要を維持
- REGIME-LOG.md 参照

### 儀式記録（本サイクルの振り返り儀式）
- レベル: 2（LC=1、機能改訂を伴う対話 → L1 実装が後段）
- スキップ: なし
- 検出件数: 矛盾 0 / 復活要求 0 / 再提案 0
- 動的格上げ／格下げ: なし

### 計算的センサー結果（5 層検出スタックの第 1 層）
| 検査 | 結果 |
|---|---|
| 型チェック（`tsc --noEmit`） | PASS |
| Lint（`biome check`） | PASS |
| Format チェック | PASS |
| テスト（`vitest run`） | PASS（227 件 / 0 失敗。F012/F013 追加分 28 件含む） |
| ビルド（`vite build`） | PASS（1.86s、PWA 生成 OK） |

### 推論的センサー結果（第 4 層：仕様照合）
- F012 全条件と実装の照合：起動・終了 ✓ / 視覚強調 ✓ / スワップ対象 ✓ / 週達成 union ✓ / 空日関係 ✓ / 過去未来許可 ✓ / 同時実行制約 ✓ / 非対応条件未実装 ✓
- F013 全条件と実装の照合：起動 ✓ / wobble 中 UI 置換 ✓ / `↑＋`/`↓＋` 挙動 ✓ / 空行への長押し無効 ✓ / 並び替え未実装維持 ✓

### 哲学整合性チェック
- F012 実装: 早い ✓（2 タップ完結）/ 簡単 ✓（既存長押しと同型）/ 便利 ✓（計画変更の標準操作）
- F013 実装: 早い ✓（常設ボタン増なし）/ 簡単 ✓（既存 wobble に統合）/ 便利 ✓（任意位置挿入）

### 次サイクル候補
- 実機（iPhone 11 / iOS Safari）で F012 移動モードと F013 wobble メニューの操作感を検証
- 必要に応じてフラッシュ演出の Tailwind カスタムアニメ化（現状は `bg-green-50` を 150ms 維持する単純切替）

---

## 2026-05-17 (LC=1 哲学確立・日付スワップ・行間挿入サイクル) [L0 のみ・実装は次サイクル]

### 追加
- 哲学「早い・簡単・便利」を確立し、INDEX.md「哲学（判定指標）」セクション + CLAUDE.md「哲学（判定指標）」セクションに恒久設置
  - 競合時は「簡単」を優先する判定ルール明記
- SPEC.md に F012 日付ごとスワップを新規追加
  - 日付ラベル 500ms 長押し → 移動モード → 目的日タップでスワップ
  - 対象: `meals[date].lines`（done/cart 含む）+ `meals[date].memo`
  - 週達成は両週再評価し union のみ（F009「減らない」セマンティクス維持）、新規達成週のみスプラッシュ発火
  - 過去日 ↔ 未来日・月またぎ可
- SPEC.md に F013 行間挿入を新規追加
  - 既存の長押し（wobble）モードを「長押しメニュー」に昇格
  - wobble 中の行内 UI を `[✓][text][↑+][↓+][✕]` に置換、`🛒`/`♡` は wobble 中のみ非表示
  - `↑+` / `↓+` で対象行の直上／直下に空行挿入 + 即フロート編集起動
  - 空行（EmptyLineItem）への長押しは無効
- INDEX.md 機能一覧に F012/F013 を追加
- DONT.md に「行・日付の操作に関する境界」セクション追加（挿入 ⇔ スワップ ⇔ 並び替え禁止 の区別明示）
- DONT.md に「哲学による却下判断」表追加（今回却下した 5 案を記録）
- history/INTENT.md に「哲学」エントリ・F012・F013 を追加

### 変更
- SPEC.md F003 完了トグル「行の追加・削除ができる。並び替え機能は実装しない」→「行の追加・削除・任意位置への挿入ができる（F013 参照）。既存行の並び替え（順序入れ替え）は実装しない」に補正
- SPEC.md F004 行削除 UI セクションを「行削除 UI / 長押しメニュー」へ改題、本セクションはモード進入・行内 UI 差し替え・削除確認ダイアログを定義、`↑+`/`↓+` の詳細は F013 へ委譲

### 廃止
- なし

### 体制
- 判定: M1 維持 (S=2, U=0, R=1, N=1) — 機能数 12 件相当でも `regime-assessment.md`「4〜10 帯 = 2 点」上限内（11 件は F011 が F002 一体運用扱い）。F012/F013 はそれぞれ独立機能だが、長押しジェスチャ・既存編集経路への統合のため複雑度寄与は限定的
- 事後評価: 本サイクルは L0（仕様改修）のみで実装は次サイクル。layer1-independent-reviewer 不要を維持
- REGIME-LOG.md 参照

### 儀式記録（本サイクルの振り返り儀式）
- レベル: 2（LC=1、機能改訂を伴う対話）
- スキップ: なし
- 検出件数: 矛盾 1（F003「並び替え機能は実装しない」と F013「行間挿入」の用語境界）/ 復活要求 0 / 再提案 0
  - 解消: 挿入 = 位置指定の追加、並び替え = 既存データの順序変更、と境界を明示し、F003 / F013 / DONT.md に整理して記録
- 動的格上げ／格下げ: なし

### 哲学整合性チェック
- F012（日付ごとスワップ）: 早い ○（2 タップ）/ 簡単 ○（既存長押しと同型）/ 便利 ○（計画変更の標準操作）
- F013（行間挿入）: 早い ○（常設ボタン増なし）/ 簡単 ○（既存長押しメニューに統合）/ 便利 ○（任意位置挿入）
- 哲学確立: 全機能の判定指標が明文化され、今後の機能追加・廃止判断に適用可能

### 次サイクル（L1 実装）への申し送り
- F012 実装: `useAppData` に `swapDays(dateA, dateB)` API 追加。`completedWeeks` の union 更新ロジックは `computeAllCompleteWeekSundays` 既存関数で両週再評価。日付ラベル長押し用の `useLongPress` を `DayRow.tsx` の左カラムへ追加
- F013 実装: `useAppData` に `insertLineAt(date, index, "above" | "below")` API 追加。`DayRow.tsx` `LineItem` の wobble 状態で `🛒`/`♡` を条件付き非表示、`↑+`/`↓+` ボタンを追加。挿入後の FloatingEditor 起動は `EditingTarget` セットで実現
- 視覚仕様: 移動モード強調色 `bg-blue-50 + ring-2 ring-blue-300`、スワップ完了フラッシュ 150ms（Tailwind の `animate-pulse-once` 相当を index.css に追加）
- テスト追加: `swapDays` の両方向対称性 / 週達成 union ロジック / `insertLineAt` の境界（先頭・末尾） / 空行長押し無効

---

## 2026-05-13 (LC=1 フロート入力フォーム導入サイクル)

### 追加
- F011 フロート入力フォーム（FloatingEditor）を新規追加（SPEC.md 該当セクション、INTENT.md F011 エントリ）
- `useAppData` に `updateLineAt(date, lineIndex, text)` API を追加（行単位 text 更新）

### 変更
- F002 フリー入力の編集導線を改訂：textarea 全行一括編集 → 各行・メモを表示専用化し、タップで F011 フロート入力フォーム起動へ集約
- SPEC.md「フリー入力」セクション内に「編集導線（2026-05-13 改訂）」サブセクションを追記
- `DayRow.tsx` の textarea 経路を撤去、行・メモは表示専用 div で描画
- `MemoField` を表示専用化（タップで親へトリガー、自身は input を保持しない）
- `App.tsx` に `EditingTarget` state と FloatingEditor を導入
- 検索ハイライト経路（`onActiveQueryChange`）を FloatingEditor 経由に再配線

### 廃止
- 旧 textarea ベースの全行一括編集モデル（行ごとの確定経路を確保したいニーズに反していたため）

### 体制
- 判定: M1 維持（規模スコア S=2、機能数 11 件は 4〜10 帯から外れるが、F011 は F002 の編集経路として一体運用のため再評価で 10 件相当と判定）
- 事後評価: 妥当（M1 で 3 サイクル運用、layer1-independent-reviewer 不要を維持）
- REGIME-LOG.md 参照

### 儀式記録（本サイクルの振り返り儀式）
- レベル: 2（LC=1、機能改訂を伴う対話）
- スキップ: なし
- 検出件数: 矛盾 0, 復活要求 0, 再提案 0
- 動的格上げ／格下げ: なし

### iOS Safari リスク再確認
- IME × フリック入力 → uncontrolled + 再マウントパターンを FloatingEditor に踏襲（F002 既存対策を流用）
- virtual keyboard × 上部 sticky フロート → visualViewport API は使わず iOS デフォルト挙動に任せる方針を SPEC.md に明記

---

## 2026-05-12 (LC=1 メタスキル適用サイクル)

### 追加
- `history/` ディレクトリを最小骨格で初期化（SUMMARY.md / INTENT.md / CHANGELOG.md / REGIME-LOG.md）
- INTENT.md に既存機能 F001〜F010 の意図・条件根拠・却下案を遡及記録
- REGIME.md に「権限委譲設定」セクション追加（L0-3 昇格、Layer 0 対話で明示同意）
- REGIME.md に「推奨モデル提示」セクション追加（Opus 4.7 単一は M1 推奨/許容帯から外れ過剰品質帯、乖離あり・コスト面のみ影響でユーザー許容済み）
- REGIME.md に「履歴更新承認設定」セクション追加（レベル A/B/C 区分）
- SPEC.md に「データモデル進化」セクション追加（既存の互換性記述を `schema-evolution.md` フォーマットに整理）

### 変更
- REGIME.md の判定日を 2026-04-19 → 2026-05-12 へ更新
- REGIME.md の機能数を 7 → 10 に補正（行削除UI / バックアップ二層 / 週達成表示 / 空状態応援を含めた現状値）
- INDEX.md に history/ への参照を追加

### 廃止
- なし

### 体制
- 判定: M1（変更なし）
- 事後評価: 妥当（M1 で 2 サイクル運用、layer1-independent-reviewer 不要を維持）
- REGIME-LOG.md 参照

### 儀式記録（本サイクルの振り返り儀式）
- レベル: 1（LC=1、機能変更なしの対話）
- スキップ: なし
- 検出件数: 矛盾 0, 復活要求 0, 再提案 0
- 動的格上げ／格下げ: なし

---

## 過去サイクル（PR #1〜#10 / 2026-04 系列 — 一次情報源: DELIVERY.md / HANDOVER.md）

本 CHANGELOG は 2026-05-12 から開始したため、過去 PR の細粒度履歴は遡及記録しない。
過去サイクルの情報源：

- 初回献上（PR #1 系列）: `DELIVERY.md` を参照
- 拡張サイクル（PR #6〜#10）: `HANDOVER.md`「現在のリポジトリ状態」を参照
- 既知未検証事項: `DELIVERY.md` 末尾 / `HANDOVER.md`「次にやる作業」優先度: 高 を参照

将来サイクルで「過去機能の廃止候補」が発生した場合は、本 CHANGELOG の該当機能 ID を INTENT.md に向けてリンクし、廃止判断プロトコル（`.claude/skills/layer0-spec-architect/SKILL.md` 「廃止判断プロトコル」セクション）を適用する。
