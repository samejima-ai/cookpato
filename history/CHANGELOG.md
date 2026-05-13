# 変更履歴

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
