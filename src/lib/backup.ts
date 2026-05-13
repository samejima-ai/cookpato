/**
 * バックアップ関連ユーティリティ。
 * - ISO 週番号フォーマットによるファイル名生成
 * - AppData の JSON 直列化／パース＋検証
 * - `<a download>` 方式のダウンロード発火（iOS Safari の OS 確認を経て Files に保存される）
 */
import { differenceInCalendarDays, getISOWeek, getISOWeekYear } from "date-fns";
import type { AppData, DateKey } from "../types";
import { fromDateKey } from "./date";
import { coerceAppData, isAppDataEffectivelyEmpty } from "./storage";

/** バックアップ書き出しの推奨間隔（日）。これを超えるとバッジを表示する */
export const BACKUP_INTERVAL_DAYS = 30;

/**
 * ISO 週番号フォーマット（例：`2026-W18`）。
 * date-fns の `getISOWeek` は ISO 8601（月曜始まり）の週番号を返す。
 */
export function formatISOWeek(date: Date): string {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-W${week.toString().padStart(2, "0")}`;
}

/** バックアップファイル名（例：`cookpato-backup-2026-W18.json`） */
export function getBackupFilename(date: Date): string {
  return `cookpato-backup-${formatISOWeek(date)}.json`;
}

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

/**
 * `<a download>` 経由のダウンロード発火。
 * iOS Safari は OS 側の確認バナーを必ず挟む（仕様上省略不可）。
 * Blob URL は次フレームで revoke して GC を促す。
 */
export function triggerDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 次のタスクで URL を解放（同期 revoke だとブラウザによってはダウンロードが開始されない）
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * 最終エクスポート日からの経過日数でバッジ表示判定。
 * 未エクスポート（null）または BACKUP_INTERVAL_DAYS 日以上経過で true。
 */
export function shouldShowExportBanner(lastExport: DateKey | null, today: DateKey): boolean {
  if (lastExport === null) return true;
  try {
    const diff = differenceInCalendarDays(fromDateKey(today), fromDateKey(lastExport));
    // 不正日付は parseISO が NaN を返し diff も NaN になる → 安全側（表示）に倒す
    if (!Number.isFinite(diff)) return true;
    return diff >= BACKUP_INTERVAL_DAYS;
  } catch {
    return true;
  }
}
