# Council 判定ログ（append-only）

Council 発動の都度 1 エントリを追記する。編集禁止。
振り返り儀式 F1-F3（PR3 で本格連携）で監査する。

---

## 2026-05-17T07:00:00Z — backup-policy-revision

- **invocation_id**: `council-2026-05-17T07:00:00Z-bkprev01`
- **source_skill**: layer1-autonomous-dev（SPEC 改修起点だがサイクル中の判断点として諮問）
- **council_type**: business
- **category**: maintenance
- **question_to_answer**: 妻の運用負荷を最小化しつつ「万が一の保険」性を維持するバックアップ機構として、A/B/C/D のどれを採用すべきか？
- **options**: A: Web Share API / B: クリップボード（催促維持）/ C: OPFS 自動スナップショット / D: クリップボード + シマエナガ催促廃止 + 復元 UI 維持
- **phase 到達**: 1→3（PR1 範囲、Phase 2 反駁はスキップ）
- **final_weights**: 経営者 3 / 開発者 5 / 哲学者 2（base 3+4+3、modifier maintenance: 0/+1/-1）
- **conflict_type**: unanimous
- **persona_stances**:
  - 経営者 → D（ROI、confidence 0.7）
  - 開発者 → D（保守性、confidence 0.85）
  - 哲学者 → D + 補強案『貼り付け先ガイダンス』（意味、confidence 0.65）
- **recommended**: Option D + 哲学者の補強（コピー時のインラインガイダンス 1 行）
- **judgment_confidence**: 0.85
- **human_escalated**: false（合意プロセスでユーザー承認、L0 改修サイクルへ移行）
- **implementer_consent**: granted（2026-05-17 L0 改修サイクル開始時にユーザー明示承認、復元 UI 2 経路維持 + `lastExport` 即時削除を合わせて確定）
- **次アクション**: ~~L0 SPEC 改修サイクル~~ → **完了**（本ログ更新と同じサイクルで実施、SPEC.md / DONT.md / INTENT.md F007 / INDEX.md / SUMMARY.md / REGIME-LOG.md / CHANGELOG.md を改修）。次は L1 実装サイクル（`useBackup` クリップボード化 + `BackupBadge` 削除 + ストック内ボタン追加 + トースト UI、詳細は CHANGELOG.md 2026-05-17「バックアップ機構クリップボード化 L0 改修サイクル」末尾の申し送り参照）
