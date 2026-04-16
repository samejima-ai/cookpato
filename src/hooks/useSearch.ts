/**
 * 過去履歴検索hook。
 * 検索欄が空のときは結果を返さない（SPEC.md の「カレンダーが見える」要件）。
 *
 * マッチの種類：
 *  - exact: 正規化後の文字列がクエリをそのまま含む
 *  - similar: カタカナ部分に 2 文字以上の共通連続がある、または文字集合の重複率が高い
 */
import { useMemo } from "react";
import { extractKatakana, hasCommonSubstring, normalize } from "../lib/normalize";
import type { AppData, SearchHit } from "../types";

const MAX_RESULTS = 20;
const SIMILAR_RATIO_THRESHOLD = 0.8;

export function useSearch(data: AppData, query: string): SearchHit[] {
  return useMemo(() => {
    const q = query.trim();
    if (q === "") return [];
    const normalizedQuery = normalize(q);
    const queryKana = extractKatakana(normalizedQuery);

    const exactHits: SearchHit[] = [];
    const similarHits: SearchHit[] = [];
    const dates = Object.keys(data.meals).sort().reverse(); // 新しい順

    for (const date of dates) {
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
    return [...exactHits, ...similarHits].slice(0, MAX_RESULTS);
  }, [data, query]);
}
