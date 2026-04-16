# Cockpato — エージェントルール

妻用の献立メモアプリ。メモ帳の手軽さ＋日付自動生成＋履歴検索＋ストック永続化。
iPhone 11（iOS Safari）でホーム画面追加して使う完全ローカル動作のPWA。

---

## 技術スタック（確定）

Layer 1 での変更禁止。変更が必要な場合は仕様レビュー結果として即献上する。

| 項目 | 採用技術 | 選定理由 |
|---|---|---|
| 言語 | TypeScript 5.x（strict mode） | 型安全性で回帰防止 |
| UI | React 18（関数コンポーネント + hooks） | 最も安定して実装できるスタック |
| ビルド | Vite | 高速ビルドで1分制約に有利 |
| スタイル | Tailwind CSS v3 | モバイルファーストで高速実装 |
| ストレージ | localStorage（単一JSON管理） | 1ユーザー・小データ量なら十分、IndexedDBより簡潔 |
| PWA | vite-plugin-pwa | iOS Safari のホーム画面追加対応が容易 |
| 日付操作 | date-fns | 軽量、dayjsとの二重化禁止 |
| テスト | Vitest + @testing-library/react | Vite統合で高速 |
| Lint/Format | Biome | ESLint+Prettierより高速、単一ツールで1分制約に有利 |
| パッケージマネージャー | npm | デフォルト、環境依存を最小化 |

---

## 原則

- 完全ローカル動作。サーバー通信コード（fetch/axios/XHR）を一切書かない
  - 理由：ユーザーデータの外部送信を完全に防ぐ
- 画面遷移を実装しない。全UIは単一ページに集約する
  - 理由：メモ帳の手軽さを守るため
- 登録ボタン・保存ボタンを配置しない。全入力は即時保存
  - 理由：既存献立アプリの最大の不満点だったため
- DONT.md に記載された機能は一切実装しない
  - 理由：機能過多が既存アプリの失敗原因

---

## コーディング規約

- 関数コンポーネント＋hooksで書く。クラスコンポーネント禁止
- 型定義は `src/types.ts` に集約する
  - 理由：検索容易性と重複防止
- localStorage読み書き等の副作用はカスタムhooksに隔離する
  - 例：`useStorage`、`useMeals`、`useStock`
- テキスト正規化（ひらがな/カタカナ統一等）は `src/lib/normalize.ts` に集約する
  - 理由：検索ロジックの一貫性確保、テスト容易性
- 日付操作は `src/lib/date.ts` に集約する。date-fns のみ使用
- Reactコンポーネントファイルはパスカルケース（例：`DayRow.tsx`）
- ユーティリティはケバブケース（例：`normalize.ts`）
- `any` 型の使用禁止。やむを得ない場合は `unknown` + type guard
- `console.log` を本番コードに残さない（デバッグ後削除）
- UI文言は全て日本語。エラーメッセージ等も日本語
- コメントは日本語OK。ただし自明なコードには付けない

---

## UI規約

- タッチターゲット最小サイズ：44×44px（iOS HIG準拠）
  - 理由：iPhone 11の実機タップで押し間違えない
- iPhone 11（論理解像度 375×812）で動作確認できる状態を保つ
- 縦画面専用。横画面対応は不要だが、崩れない程度は維持
- ダークモード対応は不要（ライトのみ）
- アニメーションは最小限。トランジションは100-200ms以内
  - 理由：軽快感の維持、iPhone 11の性能で引っかからない

---

## 禁止事項

- サーバー通信コード全般（fetch / axios / WebSocket / EventSource）
- localStorage 以外の永続化先（Cookie、IndexedDB、Web SQL）
  - 理由：単一キーのJSON管理で十分、複雑化回避
- DONT.md 記載の排除機能（カテゴリ分け、料理名マスター、レシピ、栄養計算、写真、通知等）
- 外部APIの呼び出し（翻訳API、画像CDN等）
- ユーザー追跡（Analytics、Sentry等）
- `any` 型、`@ts-ignore`（やむを得ない場合はコメントで理由明記）
- 依存パッケージの無計画な追加（追加時は理由をコミットメッセージに記載）

---

## 参照

- 仕様: INDEX.md（→ SPEC.md / DONT.md）
- センサー: sensors/computational.md, sensors/inferential.md
- スキル: .claude/skills/layer1-autonomous-dev/
