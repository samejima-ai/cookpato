/**
 * バックアップ（クリップボードコピー + テキスト復元）の薄いフック。
 *
 * 2026-05-17 F007 改訂（SPEC §「バックアップ（クリップボード方式）」）:
 * - エクスポート: `navigator.clipboard.writeText` でクリップボードに JSON をコピー
 * - 復元: JSON テキスト（ファイル経路 / 貼り付け経路の両方）を AppData として検証 → 上書き
 * 旧仕様の `lastExport` / `showBanner` / `markExported` / `exportFile` は撤去済。
 */
import { useCallback, useMemo } from "react";
import { parseBackup, serializeBackup } from "../lib/backup";
import type { AppData } from "../types";
import type { AppDataApi } from "./useAppData";

export type ImportResult = { ok: true } | { ok: false; reason: string };
export type CopyResult = "ok" | "fail";

export type UseBackupApi = {
  /**
   * 現 AppData を JSON 直列化してクリップボードへ書き込む。
   * user gesture 起源（ボタンタップ）であれば iOS Safari の permission prompt は発生しない。
   * 失敗時（権限拒否・古い iOS 等）は "fail" を返し、フォールバックは設けない（妻に負担をかけない）。
   */
  copyToClipboard: () => Promise<CopyResult>;
  /** インポート復元：AppData として検証 → 成功時に api.restoreData を呼ぶ */
  importFromText: (text: string) => ImportResult;
};

export function useBackup(api: AppDataApi): UseBackupApi {
  const copyToClipboard = useCallback(async (): Promise<CopyResult> => {
    try {
      const text = serializeBackup(api.data);
      await navigator.clipboard.writeText(text);
      return "ok";
    } catch {
      return "fail";
    }
  }, [api.data]);

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

  return useMemo(() => ({ copyToClipboard, importFromText }), [copyToClipboard, importFromText]);
}
