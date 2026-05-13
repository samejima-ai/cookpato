/**
 * バックアップ書き出しを促す「シマエナガ」のフローティングバッジ。
 *
 * 通常サイクル：
 * - 画面上部中央に長めのランダム間隔で出現する（30〜120s）
 * - 左右どちらかから滑り込み、数秒 perch（停留）した後に反対側へ滑り抜けて消える
 * - 次回サイクルは出口だった側から進入する（ジグザグに飛んでくる）
 *
 * タップ時：
 * - バッジを現在位置で凍結（mid-animation でも） + onSave 呼び出しでファイル書き出し発火
 * - 約 450ms の「処理中」演出 perch を挟む
 * - その後 boost モード（通常の約 3.3 倍速）で残り phase をスキップして反対側へ離脱
 *   「歩く → 全速力で走る」のスピード感ギャップを transition duration の差（500→150ms）で表現
 * - 離脱完了で onComplete を呼ぶ（lastExport 更新等の最終化に使う）
 *
 * 画面遷移を伴わず、入力やスクロールを阻害しないように pointer-events を制御する。
 */
import { useEffect, useRef, useState } from "react";
import shimaenagaImg from "../assets/shimaenaga-backup.png";

type Props = {
  /** バッジタップで呼ばれる（ファイル書き出しの同期発火） */
  onSave: () => void;
  /** バッジが離脱アニメーションを完了したときに呼ばれる（lastExport 記録等の最終化） */
  onComplete: () => void;
};

type Phase = "hidden" | "in" | "perch" | "out";
/** 動作モード：normal=通常 / paused=タップで停止中 / boost=バックアップ完了後の高速離脱 */
type Mode = "normal" | "paused" | "boost";

/**
 * 各 phase の dwell 時間（ms）。CSS transition 時間と一致させて、out → hidden で
 * transition-none に切り替わる際に位置がスナップしないようにする。
 * - normal: in/out 500ms（= duration-500）、perch 5s
 * - boost:  in/out 150ms（= duration-150）。perch はスキップする（残り phase 直行）
 */
function phaseDurationMs(phase: Phase, mode: Mode): number {
  if (phase === "hidden") return 30_000 + Math.floor(Math.random() * 90_000);
  if (mode === "boost") return 150;
  return phase === "perch" ? 5_000 : 500;
}

const NEXT_PHASE: Record<Phase, Phase> = {
  hidden: "in",
  in: "perch",
  perch: "out",
  out: "hidden",
};

/** タップ → ファイル書き出し発火 → 離脱開始までの「処理中」を演出する停止時間（ms） */
const PROCESSING_PAUSE_MS = 450;

export function BackupBadge({ onSave, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("hidden");
  // true: 左から進入し右へ抜ける / false: 右から進入し左へ抜ける。サイクル毎に反転
  const [leftToRight, setLeftToRight] = useState<boolean>(() => Math.random() < 0.5);
  const [mode, setMode] = useState<Mode>("normal");
  /** タップ時の現在 transform 値をスナップショットして mid-animation 位置で固定する（解放時 null） */
  const [frozenTransform, setFrozenTransform] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pauseTimerRef = useRef<number | null>(null);
  // onComplete は深い依存に巻き込まないよう ref 経由で読む
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // phase 駆動タイマー。paused 中は時計を止める
  useEffect(() => {
    if (mode === "paused") return;
    const ms = phaseDurationMs(phase, mode);
    const t = window.setTimeout(() => {
      if (phase === "out") {
        setLeftToRight((v) => !v);
        // boost 離脱が完了 → 通常モードに戻り、親に完了通知
        if (mode === "boost") {
          setMode("normal");
          onCompleteRef.current();
        }
      }
      setPhase(NEXT_PHASE[phase]);
    }, ms);
    return () => window.clearTimeout(t);
  }, [phase, mode]);

  // unmount 時の保留タイマーを掃除（onComplete 発火前に親が unmount した場合の保険）
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current !== null) window.clearTimeout(pauseTimerRef.current);
    };
  }, []);

  function handleTap() {
    // hidden / paused / boost 中は再タップ無効（normal な in/perch/out のみ反応）
    if (mode !== "normal" || phase === "hidden") return;

    // 現在の transform を実 DOM から読んで凍結（mid-animation 位置を維持）
    const node = buttonRef.current;
    if (node) {
      const t = getComputedStyle(node).transform;
      setFrozenTransform(t && t !== "none" ? t : "translateX(0)");
    }
    setMode("paused");

    // ファイル書き出しを同期発火（OS ダイアログまで誘導される）
    onSave();

    // 一定時間 perch（「処理中」演出）した後、boost 速度で離脱
    pauseTimerRef.current = window.setTimeout(() => {
      pauseTimerRef.current = null;
      setFrozenTransform(null);
      setMode("boost");
      // 残り phase をスキップして直接 out（離脱）へ。startled で bolt out するイメージ
      setPhase("out");
    }, PROCESSING_PAUSE_MS);
  }

  let translate: string;
  if (phase === "hidden") translate = leftToRight ? "-100vw" : "100vw";
  else if (phase === "in" || phase === "perch") translate = "0";
  else translate = leftToRight ? "100vw" : "-100vw";

  let transitionClass: string;
  if (mode === "paused" || phase === "hidden") transitionClass = "transition-none";
  else if (mode === "boost") transitionClass = "transition-transform duration-150 ease-in";
  else transitionClass = "transition-transform duration-500 ease-out";

  const transformStyle = frozenTransform ?? `translateX(${translate})`;
  const isHidden = phase === "hidden";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center safe-top">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleTap}
        aria-label="バックアップを保存"
        // hidden 中はオフスクリーンに居るがフォーカス可能要素として DOM に残るため、
        // a11y ツリーから除外しキーボード Tab でも到達不能にする
        aria-hidden={isHidden || undefined}
        tabIndex={isHidden ? -1 : undefined}
        className={`pointer-events-auto mt-2 w-12 h-12 flex items-center justify-center ${transitionClass}`}
        style={{ transform: transformStyle }}
      >
        <img src={shimaenagaImg} alt="" className="w-12 h-12 select-none" draggable={false} />
      </button>
    </div>
  );
}
