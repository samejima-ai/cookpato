/**
 * バックアップ（月 1 ファイル書き出し + インポート復元）の状態管理 hook。
 *
 * - 起動時に lastExport を localStorage から読み、30 日経過で showBanner=true
 * - showBanner はシマエナガバッジ（BackupBadge）の出現条件に使う。
 *   バッジには明示の閉じる操作はなく、書き出し完了で 30 日経過判定が落ちて出なくなる
 * - exportFile: ファイル書き出しを同期発火するだけ。lastExport は更新しない
 *   （バッジの離脱アニメーション完了タイミングで markExported を呼ぶ運用）
 * - markExported: 書き出し成功とみなして lastExport を更新する
 * - importFromText: JSON テキストを検証して AppData として上書き復元
 */
import { useCallback, useMemo, useState } from "react";
import {
  getBackupFilename,
  parseBackup,
  serializeBackup,
  shouldShowExportBanner,
  triggerDownload,
} from "../lib/backup";
import { todayKey } from "../lib/date";
import { loadLastExport, saveLastExport } from "../lib/storage";
import type { AppData, DateKey } from "../types";
import type { AppDataApi } from "./useAppData";

export type ImportResult = { ok: true } | { ok: false; reason: string };

export type UseBackupApi = {
  /** バックアップ催促バッジを表示すべきか（最終書き出しから 30 日経過） */
  showBanner: boolean;
  /** 最終ファイル書き出し日（DateKey、未経験は null） */
  lastExport: DateKey | null;
  /**
   * ファイル書き出しを同期発火する（OS ダイアログまで誘導）。
   * lastExport は更新しない。badge 離脱演出後に markExported で記録する想定
   */
  exportFile: () => void;
  /**
   * 書き出し成功として lastExport を today に更新する。
   * badge 離脱アニメーション完了時に呼ばれる
   */
  markExported: () => void;
  /** インポート復元：AppData として検証 → 成功時に api.restoreData を呼ぶ */
  importFromText: (text: string) => ImportResult;
};

export function useBackup(api: AppDataApi): UseBackupApi {
  const [lastExport, setLastExport] = useState<DateKey | null>(() => loadLastExport());

  const showBanner = useMemo(() => shouldShowExportBanner(lastExport, todayKey()), [lastExport]);

  const exportFile = useCallback(() => {
    const now = new Date();
    const filename = getBackupFilename(now);
    const content = serializeBackup(api.data);
    triggerDownload(filename, content);
  }, [api.data]);

  const markExported = useCallback(() => {
    const today = todayKey();
    saveLastExport(today);
    setLastExport(today);
  }, []);

  const importFromText = useCallback(
    (text: string): ImportResult => {
      const data: AppData | null = parseBackup(text);
      if (!data) {
        return { ok: false, reason: "ファイル形式が不正です" };
      }
      api.restoreData(data);
      return { ok: true };
    },
    [api],
  );

  return {
    showBanner,
    lastExport,
    exportFile,
    markExported,
    importFromText,
  };
}
