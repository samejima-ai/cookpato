# L1 指示書 — F007 バックアップ機構クリップボード化

このドキュメントは Layer 0（spec-architect）→ Layer 1（autonomous-dev）への申し送り。
本サイクル（次サイクル L1）で実装すべき変更を、SPEC.md F007 改訂と紐付けて具体化したもの。

- 仕様根拠: `SPEC.md` §「バックアップ（クリップボード方式、2026-05-17 改訂）」
- L0 改修サイクル: PR #34（`b98bd41`）
- Council 採択: `history/COUNCIL-LOG.md` 2026-05-17 backup-policy-revision（Option D、unanimous、judgment_confidence 0.85）
- 申し送り原本: `history/CHANGELOG.md` 2026-05-17 「次サイクル（L1 実装）への申し送り」

---

## サイクル目標

1. **エクスポートをクリップボードコピー方式に切替**（`<a download>` + 週番号ファイル名は廃止）
2. **シマエナガバッジ催促 UI を撤去**（30 日経過判定・`lastExport` state ごと削除）
3. **復元 UI に「クリップボードから復元」経路を追加**（ファイル復元経路は互換維持）
4. **「バックアップをコピー」ボタンをストックリスト折りたたみ内に配置**
5. **トースト UI を新規追加**（コピー成功 / 失敗 / 復元成功）
6. **旧 localStorage キー `cookpato:lastExport:v1` を初回起動時に即時削除**

哲学整合（INDEX.md / CLAUDE.md）：
- **早い** — タップ 1 回でコピー完了、OS ダイアログ・確認なし
- **簡単** — 催促 UI なし。妻に「忘れていい」と伝える設計
- **便利** — JSON 形式の保管経路を維持

---

## タスク 1: `src/lib/backup.ts` の縮約

### 削除する関数 / 定数
- `BACKUP_INTERVAL_DAYS`
- `formatISOWeek(date)`
- `getBackupFilename(date)`
- `triggerDownload(filename, content)`
- `shouldShowExportBanner(lastExport, today)`

### 維持する関数（テキスト操作で再利用）
- `serializeBackup(data)` — `JSON.stringify(data, null, 2)`。クリップボード書き込みに流用
- `parseBackup(jsonText)` — `coerceAppData` + 実質空拒否ロジックは現状維持

### 注意
- `date-fns` の `differenceInCalendarDays` / `getISOWeek` / `getISOWeekYear` への依存が無くなる。`backup.ts` 内の `import` を整理する（他箇所での参照が無ければ削除）
- `coerceAppData` / `isAppDataEffectivelyEmpty` の import は `parseBackup` で引き続き使用

---

## タスク 2: `src/lib/storage.ts` の縮約

### 削除する関数 / 定数
- `LAST_EXPORT_KEY` 定数
- `loadLastExport()`
- `saveLastExport(date)`

### 追加する起動時クリーンアップ
SPEC §「データモデル進化（旧キーの即時削除）」：
- 初回読み出し時に `localStorage.removeItem('cookpato:lastExport:v1')` を 1 度実行する
- 配置箇所案: `loadData()` 内で `STORAGE_KEY` 読み出し前後に `removeItem` を 1 行で発火（`try/catch` で握りつぶす、idempotent）
- ファイルコメント先頭の「バックアップ」セクション説明文を更新（`lastExport` の言及を削除）

### 注意（SPEC §「expand-contract プロトコル例外条項」）
- `cookpato:lastExport:v1` は **AppData プライマリではないメタ情報キー** なので、expand-contract 義務の対象外
- `cookpato:data:v1`（AppData プライマリ）には**触らない**

---

## タスク 3: `src/hooks/useBackup.ts` の刷新

### 削除する API（型 / 戻り値オブジェクトから外す）
- `showBanner`
- `lastExport`
- `exportFile()`
- `markExported()`

### 追加する API
- `copyToClipboard(): Promise<"ok" | "fail">`
  - 実装: `await navigator.clipboard.writeText(serializeBackup(api.data))` を try/catch
  - 失敗時（権限拒否・古い iOS 等）は `"fail"` を返し、フォールバックは設けない
  - 戻り値で呼び出し側がトースト文言を切り替える

### 維持する API
- `importFromText(text): ImportResult` — 既存ロジックそのまま（`parseBackup` → `api.restoreData`）

### 注意
- `useState` / `useMemo` / 内部 state は全て不要になる見込み（hook は薄いラッパーに縮小）。`useBackup` を hook のまま残すか、`const api = { copyToClipboard, importFromText }` を返す関数に格下げするかは実装判断で OK。テストの import パス維持のため hook 形のまま残す方が破壊が少ない
- `loadLastExport` / `saveLastExport` / `todayKey` / `shouldShowExportBanner` への import を削除

---

## タスク 4: `src/components/BackupBadge.tsx` の削除

- **ファイルごと削除**（`src/components/BackupBadge.tsx`）
- `src/assets/shimaenaga-backup.png` も削除して問題ない（他参照を `grep -r shimaenaga-backup src/` で確認してから）
- 関連 CSS keyframe（`animate-shimaenaga-float` / `animate-shimaenaga-float-paused` 等）が `tailwind.config.js` / `src/index.css` にあるが、他のシマエナガ装飾（F010 空状態応援）で共用していないか確認してから削除する
  - 共用していれば残す。BackupBadge 専用なら削除

---

## タスク 5: `src/components/StockList.tsx` に「バックアップをコピー」ボタン追加

### 配置
- 折りたたみ内に **`restoreSlot`（既存）と並んで** 配置する
- 機能としてのまとまりを担保するため、復元 UI の隣に置く
- 既存の `restoreSlot?: ReactNode` パターンを踏襲して `copySlot?: ReactNode` を Props に追加するか、`restoreSlot` の隣にハードコードするかは判断で OK
  - **推奨**：`copySlot?: ReactNode` を追加し、`App.tsx` 側から `<BackupCopyButton />` を注入する（責務分離）

### ボタン UI 要件
- 文言：「バックアップをコピー」
- タッチターゲット: 44×44px 以上（CLAUDE.md UI 規約。ストックリスト 36×36 例外は対象外）
- タップで `useBackup.copyToClipboard()` を await → 結果に応じてトースト発火

---

## タスク 6: トースト UI の新規追加

SPEC §「エクスポート UI（コピー）」より：

### 仕様
- **メッセージ**:
  - 成功: 「コピーしました。Keep メモやメモ帳に貼り付けて保管してください」
  - 失敗: 「コピーに失敗しました」
- **表示時間**: 3 秒、自動消去
- **位置**: 画面下部
- **挙動**:
  - `pointer-events: none` で操作を妨げない
  - `prefers-reduced-motion` でフェードを無効化
- **CLAUDE.md 規約例外**: 「アニメは 100-200ms 以内」の例外条項を SPEC で明示済（narrative animation 枠 / メッセージ読了時間確保）

### 実装方針
- **新規ファイル**: `src/components/Toast.tsx` を作成（再利用可能な汎用トースト）
  - Props: `message: string`, `kind: "info" | "error"`, `onDismiss: () => void`
  - 3 秒タイマー + フェード out
- **状態管理**: `App.tsx` に `toastState: { message; kind } | null` を持つ、または `useToast` 簡易フックを切る
- **既存 `BackupRestore` のインラインメッセージ** とは UI を統一するのが望ましい（`role="alert"` / `<output>` パターンを踏襲）

### 注意
- jsdom テストでは `prefers-reduced-motion` は false 評価。CSS のみで実装した場合はテストでアサート困難なので、トーストの DOM 出現 / 自動消滅をタイマーで検査する

---

## タスク 7: `src/components/BackupRestore.tsx` にクリップボード貼り付け経路追加

SPEC §「経路 2：クリップボード貼り付け復元」より：

### 追加する UI
- 「クリップボードから復元」ボタン
- タップで textarea を表示（モーダルでなく折りたたみ内インライン展開を推奨。妻が直前操作を見ながら貼り付けられる）
- textarea + 「復元」ボタン + 「キャンセル」ボタン
- 「復元」タップで `importFromText(textareaValue)` を呼ぶ → 既存の確認ダイアログ「現在のデータを上書きします。続行しますか？」を経由 → `parseBackup` 検証 → 成功時 `api.restoreData`

### 経路 1（ファイル復元）の維持
- 既存の `<input type="file">` 経路はそのまま温存
- 過去に `<a download>` で書き出された JSON ファイルからの**読み取り互換**を保証（SPEC §「経路 1：ファイル復元（旧仕様の互換維持）」）

### UI 構造
```
[ ファイルから復元 ]   ← 既存
[ クリップボードから復元 ] ← 新規。タップで下に展開
  ┌─────────────────────┐
  │ textarea (placeholder: "ここに貼り付け") │
  └─────────────────────┘
  [ キャンセル ] [ 復元 ]
```

### 注意（SPEC.md §「経路 2」より）
- **`navigator.clipboard.readText()` を直接呼ばない**（iOS で「貼り付けますか?」プロンプトが出るため R3 阻害）
- textarea + 貼り付けジェスチャの方が iOS 標準操作で習熟済
- 検証失敗時はインラインエラー（既存 `role="alert"`）。成功時は `<output>` で 3 秒成功メッセージ（既存パターン）

---

## タスク 8: `src/App.tsx` の配線整理

### 削除
- `import { BackupBadge } from "./components/BackupBadge";`
- `{backup.showBanner && <BackupBadge ... />}` の JSX ブロック（lines 216-218）

### 変更
- `useBackup(api)` の戻り値を新 API（`copyToClipboard` / `importFromText`）で受ける
- ストックリスト折りたたみに「バックアップをコピー」ボタンを `copySlot` 経由で注入：
  ```tsx
  <StockList
    api={api}
    copySlot={<BackupCopyButton onCopy={backup.copyToClipboard} onToast={showToast} />}
    restoreSlot={<BackupRestore importFromText={backup.importFromText} />}
  />
  ```
- トースト state（`toast: { message; kind } | null`）を追加、または `useToast` フックを切る
- `<Toast />` を画面下部に配置（fixed bottom + `pointer-events: none`）

---

## タスク 9: テスト更新

### `tests/backup.test.ts`
- **削除する describe**:
  - `formatISOWeek` 全件
  - `getBackupFilename` 全件
  - `shouldShowExportBanner` 全件
- **追加する describe**:
  - `serializeBackup`: 既存維持（インデント 2 / round-trip）
  - `parseBackup`: 既存維持（空拒否 / coerce 経由）
  - 必要なら `useBackup.copyToClipboard` のフックテスト（`navigator.clipboard.writeText` を vi.mock）

### `tests/storage.test.ts`
- `loadLastExport` / `saveLastExport` のテストを削除
- 新規追加：**`loadData()` 初回呼び出しで `cookpato:lastExport:v1` が削除される**ことの確認
  ```ts
  it("removes legacy lastExport key on first load", () => {
    localStorage.setItem("cookpato:lastExport:v1", "2026-04-01");
    loadData();
    expect(localStorage.getItem("cookpato:lastExport:v1")).toBeNull();
  });
  ```
- 旧キー不在時も冪等（エラーを投げない）ことを 1 件追加

### 既存テストへの影響
- `tests/useAppData.test.tsx`: `useBackup` 関連の参照は無いはずだが念のため確認
- `tests/StockList.test.tsx`: 新 prop `copySlot` を追加する場合、`makeProps()` モックを拡張

---

## 横断的な制約

- TypeScript strict、`any` 禁止（CLAUDE.md）
- `console.log` 残置禁止
- 新規依存パッケージ追加禁止（`navigator.clipboard` は標準 API）
- すべての UI 文言は日本語
- iPhone 11（375×812）で操作確認できる状態を維持
- **AppData プライマリキー `cookpato:data:v1` は触らない**（互換性 full-compat 維持）
- expand-contract プロトコル例外条項に従い、`cookpato:lastExport:v1` のみ即時削除

---

## 検証手順（`sensors/computational.md` 準拠）

実装完了後、以下を順に通すこと：

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

### 期待値
- typecheck: PASS
- lint: PASS（`BackupBadge.tsx` 削除で未参照 import が出ないか確認）
- format:check: PASS
- test: PASS（テスト件数は減少見込み — `getBackupFilename` / `formatISOWeek` / `shouldShowExportBanner` 関連分が消えるため）
- build: PASS（バンドルサイズは減少見込み — `differenceInCalendarDays` / `getISOWeek` 系の date-fns サブモジュールが落ちる）

### 推論センサー（`sensors/inferential.md`）
- SPEC §「バックアップ（クリップボード方式）」の 5 サブ節（エクスポート UI / 復元 UI 2 経路 / 復元共通挙動 / データモデル進化 / 廃止）すべてが実装に反映されている
- DONT.md の禁止事項に抵触しない（特に「使わない機能を画面に置かない」— ボタンは折りたたみ内で初期非表示）
- 哲学「早い・簡単・便利」3 語すべてに寄与（Council #33 採択根拠と整合）

---

## 既知未検証事項（次サイクル L1 で実機検証推奨）

- **iPhone 11 Safari スタンドアロン PWA モードでの `navigator.clipboard.writeText` 挙動**
  - user gesture 起源（ボタンタップ）であれば permission prompt なしで動くはずだが、iOS 版数による差異がある
  - 失敗時のトースト分岐が確実に発火するかを実機で確認
- **textarea への iOS 標準「貼り付け」ジェスチャ**
  - 長押し → 貼り付けメニューが普通に出ることを実機で確認
- **トーストの 3 秒滞在 + `pointer-events: none`**
  - スクロール / タップを阻害しないことを実機で確認

---

## 体制（M1 単体モード継続見込み）

- REGIME.md より M1 維持（S=2, U=0, R=1, N=1）
- 想定変更ファイル数: 7-8（うち 1 つは削除）
- 想定追加テスト件数: +5〜10
- L2 発動閾値には到達しない見込み
- 独立検証 agent は起動しない（M1 標準フロー）

---

## 完了条件

1. 上記タスク 1〜9 全て完了
2. 計算センサー 5 項目すべて pass
3. `DELIVERY.md` に本サイクル履歴を追記（変更点 / センサー結果 / 既知未検証事項 / 体制事後評価）
4. `history/CHANGELOG.md` に本サイクル（2026-05-?? L1 F007 クリップボード化実装サイクル）を追加
5. `history/SUMMARY.md` の「注意事項」セクションを更新（「L1 実装は次サイクル」→「L1 実装完了」）
6. 本ファイル（`INSTRUCTIONS.md`）は実装完了後にクリーンアップ（PR #19 の前例に従う）
