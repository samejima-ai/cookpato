/**
 * バックアップ書き出しを促す「シマエナガ」のフローティングバッジ。
 *
 * - 画面上部中央に長めのランダム間隔で出現する（30〜120s）
 * - 左右どちらかから滑り込み、数秒 perch（停留）した後に反対側へ滑り抜けて消える
 * - 次回サイクルは出口だった側から進入する（ジグザグに飛んでくる）
 * - タップで onSave を発火（B 層エクスポート）。タップは in/perch/out いずれのフェーズでも有効
 *
 * 画面遷移を伴わず、入力やスクロールを阻害しないように pointer-events を制御する。
 */
import { useEffect, useState } from "react";
import shimaenagaImg from "../assets/shimaenaga-backup.png";

type Props = {
  /** バッジタップ時に呼ばれる（バックアップ書き出しを実行） */
  onSave: () => void;
};

type Phase = "hidden" | "in" | "perch" | "out";

/** 各 phase の dwell 時間（ms）。hidden は呼び出しごとにランダム抽選する */
const PHASE_DURATIONS: Record<Phase, () => number> = {
  hidden: () => 30_000 + Math.floor(Math.random() * 90_000),
  in: () => 400,
  perch: () => 5_000,
  out: () => 400,
};

const NEXT_PHASE: Record<Phase, Phase> = {
  hidden: "in",
  in: "perch",
  perch: "out",
  out: "hidden",
};

export function BackupBadge({ onSave }: Props) {
  const [phase, setPhase] = useState<Phase>("hidden");
  // true: 左から進入し右へ抜ける / false: 右から進入し左へ抜ける。サイクル毎に反転
  const [leftToRight, setLeftToRight] = useState<boolean>(() => Math.random() < 0.5);

  useEffect(() => {
    const ms = PHASE_DURATIONS[phase]();
    const t = window.setTimeout(() => {
      // out 終端で進入方向を反転（出口側 = 次回サイクルの待機側 = 次の進入側）
      if (phase === "out") setLeftToRight((v) => !v);
      setPhase(NEXT_PHASE[phase]);
    }, ms);
    return () => window.clearTimeout(t);
  }, [phase]);

  // hidden は進入側 off-screen に駐機（transition off）。in/perch は中央。out は反対側へ離脱
  let translate: string;
  if (phase === "hidden") translate = leftToRight ? "-100vw" : "100vw";
  else if (phase === "in" || phase === "perch") translate = "0";
  else translate = leftToRight ? "100vw" : "-100vw";

  const transitionClass =
    phase === "hidden" ? "transition-none" : "transition-transform duration-500 ease-out";

  return (
    <div
      aria-hidden={phase === "hidden"}
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center safe-top"
    >
      <button
        type="button"
        onClick={onSave}
        aria-label="バックアップを保存"
        className={`pointer-events-auto mt-2 w-12 h-12 flex items-center justify-center ${transitionClass}`}
        style={{ transform: `translateX(${translate})` }}
      >
        <img src={shimaenagaImg} alt="" className="w-12 h-12 select-none" draggable={false} />
      </button>
    </div>
  );
}
