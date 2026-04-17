/**
 * 過去履歴検索hook。
 * 検索欄が空のときは結果を返さない（SPEC.md の「カレンダーが見える」要件）。
 *
 * マッチの種類：
 *  - exact: 正規化後の文字列がクエリをそのまま含む
 *  - similar: カタカナ部分に 2 文字以上の共通連続がある、または文字集合の重複率が高い
 *
 * options：
 *  - sinceDays: 今日から N 日前までの meals に走査を限定する（省略時は全期間）
 *  - maxResults: 返却する最大件数（省略時は 20）
 * アクティブ行の件数バッジ用途では、sinceDays=365／maxResults を小さめに指定して
 * 毎キーストロークの走査コストを抑える。
 */
import { useMemo } from "react";
import { addDaysKey, todayKey } from "../lib/date";
import { extractKatakana, hasCommonSubstring, normalize } from "../lib/normalize";
import type { AppData, DateKey, SearchHit } from "../types";

const DEFAULT_MAX_RESULTS = 20;
const SIMILAR_RATIO_THRESHOLD = 0.8;

export type SearchOptions = {
  sinceDays?: number;
  maxResults?: number;
  /** 走査対象から除外する日付（編集中の行が自己マッチするのを防ぐ用途） */
  excludeDate?: DateKey;
};

export function useSearch(data: AppData, query: string, options?: SearchOptions): SearchHit[] {
  const sinceDays = options?.sinceDays;
  const maxResults = options?.maxResults ?? DEFAULT_MAX_RESULTS;
  const excludeDate = options?.excludeDate;
  return useMemo(() => {
    const q = query.trim();
    if (q === "") return [];
    const normalizedQuery = normalize(q);
    const queryKana = extractKatakana(normalizedQuery);

    const sinceKey = sinceDays != null ? addDaysKey(todayKey(), -sinceDays) : null;

    const exactHits: SearchHit[] = [];
    const similarHits: SearchHit[] = [];
    const dates = Object.keys(data.meals).sort().reverse(); // 新しい順

    for (const date of dates) {
      if (excludeDate != null && date === excludeDate) continue;
      if (sinceKey != null && date < sinceKey) continue;
      // 完全一致 + 類似の合計が maxResults に達したら早期終了（軽量動作のため）
      if (exactHits.length + similarHits.length >= maxResults) break;
      const day = data.meals[date];
      if (!day) continue;
      const combined = day.lines.map((l) => l.text).join("\n");
      const normalizedCombined = normalize(combined);

      if (normalizedCombined.includes(normalizedQuery)) {
        exactHits.push({ date, lines: day.lines, matchKind: "exact" });
        continue;
      }

      if (normalizedQuery.length < 3) {
        // 短いクエリは類似マッチを無効化（誤爆防止）
        continue;
      }

      // 類似マッチ 1：カタカナ部分の共通連続（2文字以上）
      const combinedKana = extractKatakana(normalizedCombined);
      if (hasCommonSubstring(queryKana, combinedKana, 2)) {
        similarHits.push({ date, lines: day.lines, matchKind: "similar" });
        continue;
      }

      // 類似マッチ 2：文字集合の重複率
      const chars = Array.from(new Set(normalizedQuery.split("")));
      const matched = chars.filter((c) => normalizedCombined.includes(c)).length;
      const ratio = matched / chars.length;
      if (ratio >= SIMILAR_RATIO_THRESHOLD) {
        similarHits.push({ date, lines: day.lines, matchKind: "similar" });
      }
    }

    // 完全一致を先、類似を後ろ（それぞれ日付降順は保持）
    return [...exactHits, ...similarHits].slice(0, maxResults);
  }, [data, query, sinceDays, maxResults, excludeDate]);
}
