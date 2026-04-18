import weekMedalImg from "../assets/week-medal.png";

type Props = {
  /** 達成済み週の累積数（永続化されており、減らない） */
  count: number;
};

/**
 * 達成週の累積カウンタ。StockList の直上に常駐。
 * 妻の「献血カウント」的なメンタルモデルに揃え、達成感を積み上げで可視化する。
 * 0 のときも静かに表示する（まだ無い状態を隠さない）。
 */
export function MedalCounter({ count }: Props) {
  return (
    <div
      className="flex items-center gap-1 px-3 py-1 bg-white border-t border-neutral-200"
      aria-label={`達成週 ${count} 回`}
    >
      <img src={weekMedalImg} alt="" aria-hidden="true" className="w-6 h-6 shrink-0" />
      <span className="text-sm text-neutral-600">× {count}</span>
    </div>
  );
}
