# Cookpato — 献立メモアプリ

## 目的
妻（単一ユーザー）の週単位の献立計画を、メモ帳の手軽さを保ったままサポートする個人向けアプリ。
既存の献立アプリで不満だった「登録操作の多さ」「料理名統一の強制」「カテゴリ分けの強制」を排除し、
メモ帳では実現できない「日付自動生成」「過去履歴検索」「ストック永続化」だけを足す。

## 機能一覧
- カレンダー（無限スクロール）→ 詳細: SPEC.md#カレンダー無限スクロール
- フリー入力（料理名・食材名・何でもOK、1行1品）→ 詳細: SPEC.md#フリー入力
- 完了トグル（品単位でワンタップ）→ 詳細: SPEC.md#完了トグル品単位
- お気に入りマーカー（品単位、任意）→ 詳細: SPEC.md#お気に入りマーカー品単位
- 過去履歴検索（類似一致、非検索時は非表示）→ 詳細: SPEC.md#過去履歴検索
- ストックリスト（画面下部に常時表示、永続）→ 詳細: SPEC.md#ストックリスト
- バックアップ（localStorage 二重化 + 週1ファイル書き出し、完全ローカル）→ 詳細: SPEC.md#バックアップ二層構成

## スコープ外
→ DONT.md

## 開発体制
→ REGIME.md（モード: M1 単体 / Lifecycle: L=1 / ARC: monolith）

## 開発環境
→ CLAUDE.md, .claude/skills/, sensors/

## 履歴層（Lifecycle L=1）
→ history/SUMMARY.md（圧縮サマリ）
→ history/INTENT.md（機能の意図・却下案・確度）
→ history/CHANGELOG.md（時系列変遷）
→ history/REGIME-LOG.md（判定×実績の対応表）

## 開発ノート
→ docs/IOS-SAFARI-NOTES.md（IME × controlled input、setPointerCapture、touch-action、長押し領域外リリース等の落とし穴集）
