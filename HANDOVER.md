# HANDOVER — IDE 移行用引き継ぎ

Claude Code（web）セッションからローカル IDE へ作業を引き継ぐためのドキュメント。

## 現在のリポジトリ状態

- リポジトリ: `samejima-ai/cookpato`
- 最新ブランチ: `main`（このハンドオーバー作成時点で `claude/copy-dialog-harness-p2LGS` と同一コミット）
- 最新コミット: Layer 1 実装完了（React 18 + Vite 6 PWA、27/27 テスト通過、build 成功）
- Layer 0 仕様ドキュメント：完備（`INDEX.md` / `SPEC.md` / `DONT.md` / `CLAUDE.md` / `sensors/`）
- Layer 1 実装：完備（`src/` / `tests/` / `DELIVERY.md`）

## IDE ローカル環境セットアップ

### 1. クローン

```bash
git clone https://github.com/samejima-ai/cookpato.git
cd cookpato
```

### 2. 依存インストール

```bash
npm install
```

Node.js は 18 以上を推奨（Vite 6 要件）。

### 3. 動作確認

すべてが通ることを確認してから作業を始める：

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # biome check
npm run format:check # biome format
npm run test         # vitest（27件通る）
npm run build        # tsc + vite build（dist/ 生成）
npm run dev          # 開発サーバ起動 http://localhost:5173
```

### 4. 推奨 VS Code 拡張

- **Biome**（`biomejs.biome`）: ESLint + Prettier の代替。保存時フォーマットに設定すると楽。
- **Tailwind CSS IntelliSense**（`bradlc.vscode-tailwindcss`）: クラス名補完。
- **Vitest**（`vitest.explorer`）: テスト GUI 実行。

### 5. VS Code の設定例（`.vscode/settings.json`）

プロジェクトに含めるなら：

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  },
  "[typescript]": { "editor.defaultFormatter": "biomejs.biome" },
  "[typescriptreact]": { "editor.defaultFormatter": "biomejs.biome" }
}
```

## 次にやる作業（優先度順）

### 優先度：高

1. **PWA アイコン（PNG）を用意する**
   - 必要ファイル（`public/` 配下）：
     - `pwa-192x192.png`
     - `pwa-512x512.png`
     - `apple-touch-icon.png`（180×180 推奨）
   - 現状 `public/favicon.svg` のみ。これが無いとホーム画面アイコンがデフォルトになる。
   - 参照定義：`vite.config.ts` の `VitePWA` → `manifest.icons` と `includeAssets`。
   - 作り方の例：Figma / Canva でシンプルなアイコンを作り、PNG 書き出し。

2. **Vercel（または Cloudflare Pages）にデプロイ**
   - https://vercel.com/new で `samejima-ai/cookpato` を Import。
   - **Production Branch を `main` に設定**（デフォルトで main になるはず）。
   - 設定は自動検出でOK（Framework: Vite、Output: `dist`）。
   - 発行 URL（例: `https://cookpato-xxx.vercel.app`）を妻の iPhone 11 に送る。

3. **iPhone 11 Safari でホーム画面追加 → 実機動作確認**
   - 共有 → ホーム画面に追加 → フルスクリーン起動を確認。
   - 既知未検証事項（`DELIVERY.md` 参照）：
     - タッチ感（min-h-11 / min-w-11 規約で設計済み）
     - 無限スクロールの軽快さ
     - SafeArea 処理
     - 完全ローカル動作（Network タブで外部通信ゼロを確認）

### 優先度：中

4. **妻からフィードバックを集める**
   - 実際に1週間ほど使ってもらい、違和感・欲しい機能・不要そうな UI をメモしてもらう。
   - **フィードバックは仕様変更の入り口なので、Layer 1 で直接実装しない**。Layer 0 に持ち込む（下記フロー参照）。

### 優先度：低（任意・拡張）

5. PWA の offline ランタイムキャッシュ強化（現状は precache のみ）
6. 独自ドメイン設定（Vercel → Settings → Domains）
7. PNG 版アイコンのブラッシュアップ（maskable 対応など）

## 継続開発の回し方（2層スキル）

このリポジトリは `.claude/skills/layer0-spec-architect/` と `.claude/skills/layer1-autonomous-dev/` を
同梱しているので、IDE 側の Claude Code（CLI）でも同じフローが使えます。

### フィードバックを受けて機能追加する時

```
1. Claude Code に「〜が使いにくかった」「こう変えたい」と話す
   → Layer 0 スキルがトリガーされ、対話で仕様を固め SPEC.md を更新する
2. 仕様が固まったら「開発開始」と言う
   → Layer 1 スキルがトリガーされ、実装・センサー検証・DELIVERY.md 更新・コミットまで自動
3. git push → Vercel が自動デプロイ → 妻が次回アプリを開くと自動更新
```

### バグ修正・微調整の時

小さな変更は Layer 0 をスキップして直接指示してもOK。
ただし「仕様外の動作を変える」ケースは必ず Layer 0 で SPEC.md を更新してから。

## 禁止事項（CLAUDE.md 抜粋）

Layer 1 作業中は以下を守る。変更が必要な場合は Layer 0 に戻る：

- サーバー通信コード（fetch / axios / WebSocket / EventSource）禁止
- localStorage 以外の永続化（Cookie / IndexedDB / Web SQL）禁止
- 画面遷移・登録ボタン・保存ボタン 禁止
- カテゴリ / レシピ / 栄養計算 / 写真 / 通知など DONT.md 機能 禁止
- 外部 API / Analytics / Sentry 禁止
- `any` 型、`@ts-ignore` 禁止

詳細は `CLAUDE.md` と `DONT.md` 参照。

## 主要ファイル早見表

| 用途 | パス |
|---|---|
| プロジェクト目次 | `INDEX.md` |
| 機能仕様 | `SPEC.md` |
| スコープ外定義 | `DONT.md` |
| エージェントルール（技術スタック等） | `CLAUDE.md` |
| 計算センサー（コマンドチェック） | `sensors/computational.md` |
| 推論センサー（人間判断チェック） | `sensors/inferential.md` |
| 初回納品レポート | `DELIVERY.md` |
| エントリ | `src/main.tsx` → `src/App.tsx` |
| 型定義 | `src/types.ts` |
| データ管理 | `src/hooks/useAppData.ts` |
| 検索ロジック | `src/hooks/useSearch.ts` |
| 正規化ロジック | `src/lib/normalize.ts` |
| カレンダー | `src/components/Calendar.tsx` |
| 1日行 | `src/components/DayRow.tsx` |
| ストック | `src/components/StockList.tsx` |

## 連絡事項

- このセッションでのブランチ `claude/copy-dialog-harness-p2LGS` は `main` にマージ済み。
  ブランチ自体は履歴用に残しても削除してもOK。
- 次の Claude Code セッション（IDE 側）を開いた時、このファイルを読めば文脈が復元できる。
