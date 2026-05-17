/**
 * バックアップ関連ユーティリティ。
 * - AppData の JSON 直列化／パース＋検証
 *
 * 2026-05-17 改訂: クリップボード方式へ移行（SPEC §「バックアップ（クリップボード方式）」）。
 * `<a download>` 経由のファイル書き出し・週番号ファイル名生成・30 日経過判定は撤去済。
 * 直列化／検証ロジックはクリップボードコピーとファイル/貼り付け復元の両経路で再利用される。
 */
import type { AppData } from "../types";
import { coerceAppData, isAppDataEffectivelyEmpty } from "./storage";

/** AppData を JSON テキストへ直列化（インデント 2、人間も読める形にする） */
export function serializeBackup(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

/** インポート用：JSON テキストを AppData として安全にパースする。失敗時 null */
export function parseBackup(jsonText: string): AppData | null {
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const data = coerceAppData(parsed);
    // 完全に空のデータは「不正ファイル or 別形式」とみなして拒否（現データ全消しの事故防止）
    if (isAppDataEffectivelyEmpty(data)) return null;
    return data;
  } catch {
    return null;
  }
}
