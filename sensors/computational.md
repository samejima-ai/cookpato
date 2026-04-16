# 計算的センサー

決定論的で高速な検証。全て1分以内に完了する制約。
Layer 1 は自己検証時にこれらを順に実行し、全てpassしたら推論的センサーに進む。

---

## 型チェック
- コマンド: `npm run typecheck`
- 実体: `tsc --noEmit`
- 成功条件: エラー0件
- 制約: 30秒以内
- 失敗時の対処: 型エラーを修正。`any` や `@ts-ignore` での回避は最終手段

## Lint
- コマンド: `npm run lint`
- 実体: `biome check .`
- 成功条件: エラー0件（warningは許容）
- 制約: 10秒以内
- 失敗時の対処: `npm run lint:fix`（`biome check --write .`）で自動修正を試み、残ったものを手動修正

## Format チェック
- コマンド: `npm run format:check`
- 実体: `biome format .`
- 成功条件: 差分なし
- 制約: 5秒以内
- 失敗時の対処: `npm run format`（`biome format --write .`）で自動整形

## テスト
- コマンド: `npm test`
- 実体: `vitest run`
- 成功条件: 全件pass
- 制約: 1分以内
- 失敗時の対処: テストが通るように実装を修正。テストそのものの修正は仕様と照合してから

## ビルド
- コマンド: `npm run build`
- 実体: `tsc --noEmit && vite build`
- 成功条件: exit code 0
- 制約: 1分以内
- 失敗時の対処: ビルドエラーを修正。警告は見直しの機会とする

---

## 実行順序

以下の順で実行し、先のステップが失敗したら後続は実行しない。

1. `npm run typecheck`
2. `npm run lint`
3. `npm run format:check`
4. `npm test`
5. `npm run build`

全パスで献上可能。

---

## 自力修正の上限

- 同一エラーに対する修正試行は最大3回
- 3回で解決しない場合はフィードバックレポートに記載して献上に進む
- エラーのパターンが毎回違う場合は「同一エラー」とみなさない
