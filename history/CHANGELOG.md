# 変更履歴

## 2026-05-31 (LC=1 未来空日の入力導線を ＋マーク → ★5行展開に変更 L0+L1 サイクル)

前サイクル（同日、#41）で未来空日に「入力起点★を 1 本」描画する実装をマージ後、ユーザーから「★1行よりも ＋マークを配置してタップで★を5行表示する方がいい」との要望。複数品をまとめて書く際に5行並ぶ方が見通しが良いため、未来空日（today+7 以降）の入力導線を **「＋マーク → タップで空行5行展開」** に変更。応援ウィンドウ（today〜today+6）の自動4空行は据え置き。L0 SPEC 追補 + L1 実装を同 PR で完遂。

### 設計判断（＋マーク方式）
- 未来空日（行データ無し）に ＋マーク（「献立を書く」ボタン）を 1 つ描画
- タップで `bulkAddEmptyLines([date], 5)` により空行 5 行を展開 → 各 ★ をタップしてフロート編集
- ＋マークは**空日専用**（既存行がある日には出ない＝長押しメニュー `↓+` と機能重複しない）。2026-05-21 に廃止した行末「＋追加」常設ボタン（既存行末に常設・`↓+` と重複）とは別物

### 改訂（SPEC / DONT / INTENT）
- SPEC.md F013「空日の入力可否」：today+7 以降の入力導線を「★1本」→「＋マーク → ★5行展開」に変更、再評価の経緯に追補
- DONT.md 却下表「行末＋追加ボタン」行：＋マークが空日専用で `↓+` と重複しない＝廃止した常設ボタンとは別物、と整理
- history/INTENT.md F013：改訂歴に追補（＋マーク方式）

### L1 実装（useAppData は変更なし、既存 bulkAddEmptyLines を流用）
- `src/components/DayRow.tsx`: 空日（lines=[] && canInput）の `EmptyLineItem`（★1本）を `AddDayButton`（＋マーク）に置換。新 prop `onExpandEmptyDay`、`AddDayButton` コンポーネント新設
- `src/components/Calendar.tsx`: Props に `onRequestExpandDay` 追加、DayRow へ中継
- `src/App.tsx`: `EMPTY_DAY_EXPAND_LINE_COUNT = 5` 定数、`handleRequestExpandDay`（`bulkAddEmptyLines([date], 5)`）追加、Calendar へ配線
- `tests/DayRow.test.tsx`: 空日起点テストを★1本→＋マーク仕様に更新（baseProps に `onExpandEmptyDay`、＋マーク描画/★非描画/タップ/過去日非表示の 4 テスト）

### 体制
- 判定: M1 維持 (S=2, U=0, R=1, N=1)
- 事後評価: 妥当。前サイクルの UX 微調整（同日の追補）。component/App の局所変更、useAppData の API 変更なし

### 儀式記録（本サイクルの振り返り儀式）
- レベル: 2（仕様変更を伴う対話）
- スキップ: なし
- 検出件数: 矛盾 0 / 復活要求 1（要整理）/ 再提案 0
  - 復活要求 1: ユーザー提案の「＋マーク」が DONT.md 却下表「行末＋追加常設ボタン」に表面的に該当。**空日専用（`↓+` と重複しない別文脈）**であり「重複していた常設ボタンの復活」ではないと整理し、ユーザーに提示・合意。DONT.md 却下表に整理を追記
- 動的格上げ／格下げ: なし
- 廃止判断プロトコル発動: なし

### 哲学整合性チェック
- ＋マーク → ★5行展開: 早い ○（1品のみなら★1本と同等、複数品ならむしろ手数減）/ 簡単 ○（応援ウィンドウと同じ★が並ぶ状態に統一、見通し良い）/ 便利 ○（まとめて書ける）— **3 語すべてに寄与（または損ねない）**
- ＋マークは空日専用で `↓+` と重複しないため、CLAUDE.md「常設ボタン削減」原則・DONT.md「行末＋追加廃止」と矛盾しない

### 計算的センサー結果（5 層検出スタックの第 1 層）
| 検査 | 結果 |
|---|---|
| 型チェック（`tsc --noEmit`） | PASS |
| Lint（`biome check`） | PASS |
| テスト（`vitest run`） | PASS 227/227（DayRow 44→45） |
| ビルド（`tsc + vite build`） | PASS |

### 既知未検証事項（実機 iPhone 11 / iOS Safari）
- ＋マークタップ → ★5行展開 → ★タップ → フロート編集 の一連が滑らかか
- ＋マークの見た目が「行がある日の操作」と混同されないか（空日専用で出る文脈の分かりやすさ）

---

## 2026-05-31 (LC=1 入力できる期間の再評価・未来空日の入力導線解放 L0+L1 完遂サイクル)

妻から「6/7 以降の献立が書けない」報告。調査の結果、2026-05-21（PR #40）で「行末『＋追加』ボタン廃止」と同時に確定した「過去日 / today+7 以降の空日への新規追加経路は提供しない（仕様確定）」が原因と判明。当時の前提「遠い未来日への先行入力はほぼ発生しない」が覆ったため、SPEC が予約していた再評価条件に従い **未来空日の入力導線を解放**（応援表示の範囲は据え置き＝「入力導線だけ解放」）。L0 SPEC 改訂 + L1 実装を同 PR で完遂。

### 設計判断：応援表示と入力可否の概念分離
- 旧：`inCheerWindow`（today〜today+6）の 1 変数で「応援表示（シマエナガ + 自動 4 空行）」と「★入力導線の表示可否」を兼用していた
- 新：2 概念に分離
  - **応援表示**（シマエナガ装飾 + 起動時自動 4 空行投入）：today〜today+6 のまま据え置き（F010、プレッシャー回避意図を維持）
  - **入力可否**：`isInputableDate(date, today)`（`date >= today`）。today 以降の全空日で入力導線（★）を描画
- 過去日（today 未満）の空日は据え置き（入力導線なし）。今回の報告は未来日のみ・ユーザー選択

### 改訂（SPEC / DONT / INTENT）
- SPEC.md F010「空状態の応援表示」§概要に「応援装飾と入力導線は別概念」注記を追加
- SPEC.md F013「行末追加 UI の廃止」の §残存する追加経路 を改訂（today 以降の空日に入力導線を提供）、§inCheerWindow 外空日の取り扱い → §空日の入力可否（2026-05-31 再評価）へ書き換え（再評価の経緯・概念分離を明記）
- DONT.md 哲学却下表「行末『＋追加』常設ボタン」行に 2026-05-31 再評価注記（入力導線は★起点で復活、常設ボタン却下自体は維持）
- history/INTENT.md F010 / F013 に改訂歴・前提変更の訂正（取り消し線）

### L1 実装（App.tsx / useAppData.ts は変更なし）
- `src/lib/date.ts`: `isInputableDate(key, today)` を追加（`date >= today`、DateKey 辞書順比較）
- `src/lib/cheer.ts`: `computeCheerWindow` を撤去（★判定は date 比較へ移譲）、`computeCheerDates`（シマエナガ）は据え置き、コメントで役割分離を明記
- `src/components/Calendar.tsx`: `computeCheerWindow` import / `cheerWindow` useMemo を撤去、DayRow へ `canInput={isInputableDate(date, today)}` を渡す
- `src/components/DayRow.tsx`: prop `inCheerWindow` → `canInput` にリネーム（意味変更）、空行★描画条件を `canInput` に変更、**lines が空（行データなし）かつ canInput の日に入力起点★を 1 本描画**（タップで `onInsertLineAt(0, "below")` → 既存 `handleRequestInsertLine` → `insertLineAt` で先頭行生成 → フロート編集起動）
- `tests/cheer.test.ts`: `computeCheerWindow` describe を撤去（`computeCheerDates` テストは応援据え置きのため維持）
- `tests/DayRow.test.tsx`: `inCheerWindow` → `canInput` 全置換、空日入力起点の新規テスト 3 件追加
- `tests/date.test.ts`: `isInputableDate` テスト追加

### 体制
- 判定: M1 維持 (S=2, U=0, R=1, N=1)
- 事後評価: 妥当。実装は lib/component の局所変更（App / useAppData の API 変更なし）。機能の純増はなく既存制約の緩和

### 儀式記録（本サイクルの振り返り儀式）
- レベル: 2（LC=1、仕様変更を伴う対話。当初「バグ報告」だが実態は 2026-05-21 確定仕様の再評価）
- スキップ: なし
- 検出件数: 矛盾 0 / 復活要求 0 / 再提案 0
  - F2 で「2026-05-21 の前提（遠い未来の先行入力ほぼ発生しない）が妻報告で覆った」を検出・提示。SPEC:367 が再評価条件を予約済みのため「正当な再評価の発動」として整理（矛盾ではない）
- 動的格上げ／格下げ: なし
- 廃止判断プロトコル発動: なし（機能追加でも廃止でもなく、既存制約の緩和。常設ボタン却下は維持）

### 哲学整合性チェック
- 未来空日の入力導線解放: 早い ○（新規常設ボタンなし、既存★パターン）/ 簡単 ○（today 以降は一律入力可、妻が「どの日は書ける/書けない」を意識せず済む）/ 便利 ○（書きたい未来日に書ける、報告された不便を解消）— **3 語すべてに寄与**
- 応援表示を 7 日に据え置いたのは F010「プレッシャー回避」意図の維持（応援と入力の分離で両立）

### 計算的センサー結果（5 層検出スタックの第 1 層）
| 検査 | 結果 |
|---|---|
| 型チェック（`tsc --noEmit`） | PASS |
| Lint（`biome check`） | PASS |
| テスト（`vitest run`） | PASS 225/225（cheer -2 / DayRow +3 / date +1） |
| ビルド（`tsc + vite build`） | PASS（dist 377.55 kB JS / gzip 89.10 kB、PWA 生成 OK） |

### 推論的センサー結果（第 4 層：仕様照合）
- SPEC「空日の入力可否」と実装の照合：入力可否＝today 以降 ✓ / 応援表示＝today〜today+6 据え置き ✓ / 過去日の入力導線なし ✓ / 未来空日の起点★→`insertLineAt` 行生成 ✓
- DONT.md 抵触なし（常設ボタン却下維持、★は既存パターンの拡張）

### 既知未検証事項（実機 iPhone 11 / iOS Safari で確認推奨）
- today+7 以降の未来空日タップ → 起点★ → 行生成 → フロート編集起動の一連が滑らかか
- 過去日タップで入力導線が出ないこと（据え置き挙動）の体感確認

---

## 2026-05-21 (LC=1 F013 改訂・行末「＋追加」ボタン廃止 L0+L1 完遂サイクル)

妻運用後の評価で「料理名リスト最下部の＋追加ボタンは F013 長押しメニューの `↓+` と重複しているため不要」と判明（ユーザー発話 2026-05-21）。
L0 spec-architect で SPEC 改訂、続けて L1 autonomous-dev で実コード撤去・テスト整備まで同 PR（#40）で完了。

### 改訂（F013 行間挿入 + 行末追加 UI 廃止）
- SPEC.md F013「行間挿入」セクション改訂：
  - §概要：「末尾追加（行末の `＋追加` ボタン）に加えて任意位置への挿入」→「任意位置への挿入を長押しメニューに統合 + 末尾追加は末尾行長押し → `↓+` に一本化」へ書き換え
  - `↑+` 条件：「`＋追加` ボタンと編集起動の挙動を揃える」→「挿入直後のフロート編集起動は F011 既存仕様に従う」へ書き換え
  - `↓+` 条件：「末尾行に対する `↓+` は末尾の `＋追加` ボタンと等価」→「末尾追加経路の主経路（2026-05-21 改訂で `＋追加` 廃止）」へ書き換え
  - 確定／キャンセル条件：「既存の末尾「＋追加」→ キャンセル時の挙動と同一」の比較参照を撤去
  - F013 末尾に **「行末追加 UI の廃止（2026-05-21）」サブセクション** を新設：廃止対象 / 廃止根拠 / 残存する追加経路 / inCheerWindow 外空日の取り扱い / 影響範囲（DayRow.tsx 該当ブロック・撤去候補の連鎖関数）を明文化
- DONT.md「哲学による却下判断」表に **「行末「＋追加」常設ボタン」** 行を追加：早い・簡単 を損ねる、F013 `↓+` で代替可能、過去日追記ユースケースは妻運用上ほぼゼロ
- history/INTENT.md F013 を改訂版に書き換え：状態に「2026-05-21 改訂」明記、改訂歴セクション追加、却下案の「既存末尾「＋追加」を「位置選択モード」に変更」に取り消し線を追加（前提条件喪失で無効化）、廃止要素として「行末「＋追加」常設ボタン」「`addLineAt(date, "end")` の `＋追加` ボタン経由呼び出し」を取り消し線で記録

### 撤去（SPEC deprecation + 実装コード物理削除、本 PR で完了）
本サイクルで仕様文書上の「廃止」確定と実装コードの物理削除をワンショットで実施。
- `src/components/DayRow.tsx` の `<button onClick={handleAddLine} aria-label="行を追加">＋</button>` ブロック（行末常設「＋」ボタン）— SPEC 削除 + 実装撤去済
- `DayRow.tsx` の `onAddLine` プロップ + ローカルハンドラ `handleAddLine`、`Calendar.tsx` の `onRequestAddLine` 中継、`App.tsx` の `handleRequestAddLine` ハンドラ — 全経路撤去済
- `useAppData.ts` の `addLineAt(date, "end")` API — 他に呼び出し箇所なし確認の上で本 PR で撤去（末尾追加は F013 `insertLineAt(..., "below")` で代替）。`bulkAddEmptyLines`（F010 自動 4 空行生成）は別経路のため維持

### 仕様確定（inCheerWindow 外空日の追加経路）
- 過去日 / today+7 以降の空日（lines.length === 0）への **新規追加経路は提供しない**（妻運用上ほぼ発生しないことを 2026-05-21 ユーザー確認で取得）
- 将来運用変化があれば再評価可能（DONT.md「将来スコープに入る可能性があるもの」枠で扱う）

### 体制
- 判定: M1 維持 (S=2, U=0, R=1, N=1)
- 事後評価: 妥当。機能削除は機能数の純減で、複雑度はむしろ減少。M1 で 7 サイクル目の運用継続

### 儀式記録（本サイクルの振り返り儀式）
- レベル: 2（LC=1、機能改訂を伴う対話）
- スキップ: なし
- 検出件数: 矛盾 0 / 復活要求 0 / 再提案 0
  - F013 INTENT 過去却下案「既存末尾「＋追加」を「位置選択モード」に変更」は **前提条件変更による正当な進化** として整理（矛盾ではない）。取り消し線で過去記録を残しつつ無効化を明示
- 動的格上げ／格下げ: なし
- 廃止判断プロトコル発動: 本件は機能削除を伴うが、「F013 機能の改訂（行末追加経路の主経路を `↓+` に切替）」の枠で扱える。新規追加経路の喪失（inCheerWindow 外空日）は妻ユースケース確認で許容済のため、合議発動は不要と判断

### 哲学整合性チェック
- 行末「＋追加」廃止：早い ○（常設ボタン 1 個減で操作面が軽くなる）/ 簡単 ○（機能重複解消、メンタル混乱低減）/ 便利 △（inCheerWindow 外空日への追加経路喪失だが妻運用上ほぼ影響なし）— **3 語すべてに寄与（または損ねない）** で採択基準を満たす

### L1 実装内容（本 PR で完了）
- `src/components/DayRow.tsx`: 行末「＋追加」ボタンの `<button>` ブロックを削除、`onAddLine` プロップと `handleAddLine` ローカルハンドラを撤去
- `src/components/Calendar.tsx`: `onRequestAddLine` プロップと DayRow への `onAddLine` 注入を撤去
- `src/App.tsx`: `handleRequestAddLine` ハンドラと Calendar への `onRequestAddLine` 注入を撤去
- `src/hooks/useAppData.ts`: `addLineAt` 実装と `AppDataApi` 型からの API 露出を撤去（末尾追加は F013 `insertLineAt` で代替可能）
- `tests/DayRow.test.tsx`: 「＋追加」describe を「廃止確認（行末追加ボタンが描画されない）」テストに置換
- `tests/StockList.test.tsx`: `makeApi` モックから `addLineAt: vi.fn()` を撤去（型整合）
- `tests/useAppData.test.tsx`: `addLineAt` describe（3 件）を撤去、`insertLineAt` `below` テストのコメント文言修正

### 計算的センサー結果（5 層検出スタックの第 1 層）
| 検査 | 結果 |
|---|---|
| 型チェック（`tsc --noEmit`） | PASS |
| Lint（`biome check`） | PASS |
| Format（`biome format`） | PASS |
| テスト（`vitest run`） | PASS 224/224（＋追加関連 4 件削除で 228 → 224） |
| ビルド（`tsc + vite build`） | PASS |

### 実機確認
- iPhone 11 / iOS Safari（Vercel preview URL 経由）での操作確認 — **OK**（2026-05-21、ユーザー報告）
  - `↓+`（末尾行長押し → メニュー）での末尾追加が「＋追加」と同等以上の手早さで成立することを確認

---

## 2026-05-17 (LC=1 F007 改訂3 — swipe-reveal 化サイクル)

動作確認後の妻側フィードバック「バックアップはスライドしたら出るけど自然に隠れる動作にして。
引っ張って 3 秒後には隠れる感じ」を受け、常時表示の「バックアップ」ボタンを
ストックヘッダー swipe で 3 秒だけ slide-in する形に変更。

### 追加
- `src/components/StockList.tsx` にヘッダー vertical swipe 検出（>= 30px）+ reveal タイマー（3 秒）を追加
  - `pointerdown` / `pointermove` / `pointerup` / `pointercancel` で `|dy|` の最大値を測り、`pointerup` 時点で 30px 以上なら `revealBackup()` 発火
  - `lastSwipeRevealAtRef` で直近 reveal 時刻を覚え、200ms 以内の `onClick` は無視（swipe と tap の干渉防止）
  - `revealTimerRef` で 3 秒タイマー、unmount 時に掃除
  - `BACKUP_REVEAL_THRESHOLD_PX = 30` / `BACKUP_REVEAL_DURATION_MS = 3000` 定数
- `StockList` JSX の最下層に `<div className="absolute top-0 right-0 ...">` で `backupTrigger` を配置。`translate-x` + `opacity` の 200ms ease-out trans で slide-in/out

### 変更
- `StockList` Props: `backupSlot?: ReactNode` → `backupTrigger?: ReactNode` に rename + 配置位置を「折りたたみ body 末尾」→「ヘッダー右端 absolute 重ね」に変更
- `App.tsx` の prop 名を追従（`backupSlot` → `backupTrigger`）
- `SPEC.md` §「バックアップ」を改訂3 へ：見出しに「+ swipe-reveal」追加、§「エントリ UI」サブセクションを全面書き換え（swipe 検出条件、200ms tap 干渉防止、3 秒タイマー起点、設計判断）
- `INDEX.md` / `history/SUMMARY.md` の F007 説明文を改訂3 反映に更新
- `StockList` の最外 wrapper に `relative` 追加（backup trigger の absolute 位置決め用）

### 廃止
- ストック折りたたみ body 末尾の `backupSlot` 描画箇所（不要、ヘッダー swipe-reveal に移動）

### 体制
- 判定: M1 維持 (S=2, U=0, R=1, N=1)
- 事後評価: 妥当。妻の動作確認フィードバック → SPEC 改訂 + 実装まで 1 サイクルで完遂、テスト破損なし

### 儀式記録
- レベル: 1（LC=1、UX 微調整 + SPEC 改訂）
- スキップ: なし
- 検出件数: 矛盾 0 / 復活要求 0 / 再提案 0
  - 注：`StockList` のヘッダー周りで「テスト破損リスク」を最初に発生させた（最外 wrapper に `<div className="relative">` を挟んだことで `header.nextElementSibling === accordion` が崩れた）が、`<div>` を outer の outer に統合する形で構造を保ち、テストすべて pass に戻した

### 計算的センサー結果
| 検査 | 結果 |
|---|---|
| 型チェック（`tsc --noEmit`） | PASS |
| Lint（`biome check`） | PASS |
| Format（`biome format`） | PASS |
| テスト（`vitest run`） | PASS 228/228 |
| ビルド（`tsc + vite build`） | PASS |

### 哲学整合性チェック
- F007 改訂3: 早い ✓（swipe 1 回で出る、tap 1 回で modal）/ 簡単 ✓（普段は完全に隠れる → メンタル負荷ゼロ、緊急時の保険感が伝わる）/ 便利 ✓（バックアップ機能の発見性は若干下がるが、ユーザーが望んで作ったジェスチャなので学習コストは低い）

---

## 2026-05-17 (LC=1 F007 改訂2 — 動作確認フィードバック対応・popup 化サイクル)

動作確認後の妻側フィードバック「ストック内でのストック以外のスクロールは嫌」を受け、
ストック折りたたみ内インライン配置 → 単一「バックアップ」ボタン + 中央 modal 集約に再設計。

### 追加
- `src/components/BackupSheet.tsx` 新規。ストック折りたたみ内の「バックアップ」エントリボタン + 中央 modal を統合。modal 内に「バックアップをコピー」「ファイルから復元」「クリップボードから復元」3 操作を集約。背景タップ / Escape / × で閉じる。コピー成功時 modal 自動クローズ + トースト、失敗時 modal 開いたまま + エラートースト。復元成功はインライン `<output>` 3 秒（modal 開いたまま）

### 変更
- `SPEC.md` §「バックアップ」を全面改訂：見出しを「クリップボード方式 + modal 集約、2026-05-17 改訂2」に変更、概要に「妻の動作確認フィードバック受領」を明記、「エントリ UI」サブセクション新設、復元 UI を「modal 内 2 経路」に書き換え、トースト a11y / `prefers-reduced-motion` の CSS 直接処理（Tailwind `motion-safe:` は不適）も SPEC に反映
- `src/components/StockList.tsx`：`copySlot?: ReactNode` + `restoreSlot?: ReactNode` → 単一 `backupSlot?: ReactNode` に統合
- `src/App.tsx`：`BackupCopyButton` + `BackupRestore` 注入を廃止し、単一 `<BackupSheet>` を `backupSlot` に注入
- `INDEX.md` 機能一覧の F007 説明を「ボタン → modal」型に更新
- `history/SUMMARY.md` の F007 説明を改訂2 反映に更新

### 廃止（コード撤去完了）
- `src/components/BackupCopyButton.tsx` をファイルごと削除（BackupSheet にロジック吸収）
- `src/components/BackupRestore.tsx` をファイルごと削除（BackupSheet にロジック吸収）

### 体制
- 判定: M1 維持 (S=2, U=0, R=1, N=1)
- 事後評価: 妥当。妻の動作確認フィードバック → 1 サイクルで SPEC 改訂 + 実装まで完遂

### 儀式記録（本サイクルの振り返り儀式）
- レベル: 1（LC=1、軽微な UX 改善 + SPEC 改訂を伴う）
- スキップ: なし
- 検出件数: 矛盾 0 / 復活要求 0 / 再提案 0

### 計算的センサー結果
| 検査 | 結果 |
|---|---|
| 型チェック（`tsc --noEmit`） | PASS |
| Lint（`biome check`） | PASS |
| Format（`biome format`） | PASS |
| テスト（`vitest run`） | PASS 228/228 |
| ビルド（`tsc + vite build`） | PASS |

### 哲学整合性チェック
- F007 改訂2: 早い ✓（ボタン 1 タップで modal、コピー成功で自動クローズ）/ 簡単 ✓（ストック領域がボタン 1 つだけのシンプル状態に戻る、迷わない）/ 便利 ✓（3 操作の集約で「バックアップ系」のメンタルモデルが 1 個所に）
- 妻フィードバック「ストック以外のスクロール嫌」は「簡単」の損失 → 改訂2 で解消

---

## 2026-05-17 (LC=1 F007 クリップボードバックアップ L1 実装サイクル)

### 追加
- `src/hooks/useBackup.ts` を全面刷新。`copyToClipboard()` / `importFromText()` の 2 API に集約。`navigator.clipboard.writeText` で JSON を書き込み、失敗時は `"fail"` を返してフォールバックなし（妻に負担をかけない設計）
- `src/components/Toast.tsx` を新規追加。画面下部 3 秒滞在、`pointer-events: none` で操作阻害なし、`motion-safe:animate-toast-fade` 150ms フェードイン、`prefers-reduced-motion` 配慮
- `src/components/BackupCopyButton.tsx` を新規追加。`onCopy` 結果に応じて成功 / 失敗トーストを発火
- `src/components/StockList.tsx` に `copySlot?: React.ReactNode` プロップを追加（折りたたみ展開時末尾、`restoreSlot` の隣に描画）
- `src/components/BackupRestore.tsx` に経路 2「クリップボードから復元」を追加。textarea → 「復元」ボタン → 確認ダイアログ → 確定タップで初めて `importFromText` を呼ぶ順序
- `src/index.css` に `@keyframes toast-fade` / `.animate-toast-fade` を追加
- `tests/useBackup.test.tsx` を新規追加（`copyToClipboard` 成功 / 失敗の必須 2 ケース + `importFromText` 3 ケース）
- `tests/storage.test.ts` に旧 `cookpato:lastExport:v1` キー削除の 3 ケースを追加

### 変更
- `src/lib/storage.ts` の `loadData()` 初回呼び出し時に `localStorage.removeItem('cookpato:lastExport:v1')` を idempotent 実行（expand-contract プロトコル例外条項）
- `src/components/BackupRestore.tsx` のファイル復元ボタン文言を「バックアップから復元」→ **「ファイルから復元」** に改名（SPEC §「経路 1」定義 + 2 経路の文言区別）
- `src/App.tsx`：`<BackupBadge>` 描画削除、`toast` state + `showToast` / `dismissToast` ハンドラ追加、`<Toast>` を画面下部に配置、`<StockList copySlot={<BackupCopyButton>}>` を注入

### 廃止（コード撤去完了）
- `src/components/BackupBadge.tsx` をファイルごと削除（旧 PR #29-#30 の歩行アニメ含む全機能）
- `src/assets/shimaenaga-backup.png` を削除（他参照なし、`shimaenaga-cart.png` は買い物マーカーで使用継続のため維持）
- `src/index.css` の `@keyframes shimaenaga-float` / `.animate-shimaenaga-float` / `.animate-shimaenaga-float-paused` 定義および `prefers-reduced-motion` 配下の関連定義を削除
- `src/lib/backup.ts`：`BACKUP_INTERVAL_DAYS` / `formatISOWeek` / `getBackupFilename` / `triggerDownload` / `shouldShowExportBanner` を削除。`date-fns` の `differenceInCalendarDays` / `getISOWeek` / `getISOWeekYear` import も撤去
- `src/lib/storage.ts`：`LAST_EXPORT_KEY` 定数 / `loadLastExport` / `saveLastExport` を削除
- `src/hooks/useBackup.ts`：`showBanner` / `lastExport` / `exportFile` / `markExported` API を削除
- `tests/backup.test.ts`：`formatISOWeek` / `getBackupFilename` / `shouldShowExportBanner` の describe を削除
- `tests/storage.test.ts`：`loadLastExport / saveLastExport` の describe を削除
- ルートの `INSTRUCTIONS.md` をクリーンアップ（PR #19 前例に従う、本サイクル完了の証跡）

### 体制
- 判定: M1 維持 (S=2, U=0, R=1, N=1)
- 事後評価: 妥当。INSTRUCTIONS.md が機能×タスク粒度で完全に確定しており、迷う場面はなかった。M1 で 5 サイクル運用継続
- REGIME-LOG.md 参照

### 儀式記録（本サイクルの振り返り儀式）
- レベル: 1（LC=1、L1 実装サイクル、SPEC 改変なし）
- スキップ: なし
- 検出件数: 矛盾 0 / 復活要求 0 / 再提案 0

### 計算的センサー結果（5 層検出スタックの第 1 層）
| 検査 | 結果 |
|---|---|
| 型チェック（`tsc --noEmit`） | PASS |
| Lint（`biome check`） | PASS |
| Format（`biome format`） | PASS |
| テスト（`vitest run`） | PASS 228/228 |
| ビルド（`tsc + vite build`） | PASS（dist 375.18 kB JS / gzip 88.49 kB） |

### 哲学整合性チェック
- F007 改訂 L1 実装: 早い ✓（クリップボードコピー 1 タップ）/ 簡単 ✓（催促 UI 完全撤去、妻に何も求めない）/ 便利 ✓（保管経路維持 + ファイル / 貼り付け 2 経路の対称運用）
- 採択された Option D（L0 サイクル）の 3 語整合性を実装側でも保持

### 既知未検証事項（次回 L0 レビュー時に妻の端末で確認）
- 実機 iPhone 11 Safari スタンドアロン PWA モードでの `navigator.clipboard.writeText` 挙動（user gesture 起源の permission prompt 有無、版数差異）
- textarea への iOS 標準「貼り付け」ジェスチャ実動作
- トーストの 3 秒滞在 + `pointer-events: none` がスクロール / タップを阻害しないこと

---

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
