/**
 * バックアップ書き出しを促す「シマエナガ」のフローティングバッジ。
 *
 * 通常サイクル：
 * - 長めのランダム間隔（30〜120s）の後、画面外から歩行開始
 * - 上部をゆっくり歩くペース（約 10s で画面横断、linear）で通過する
 * - 歩行中は上下に「ふわふわ」揺れる（CSS keyframe、約 1.8s 周期）
 * - 通過後は次サイクル準備で待機（leftToRight 反転、次は反対側から進入）
 *
 * タップ時：
 * - 現位置で停止（揺れも止まる）＋ onSave 発火（ファイル書き出し）
 * - 約 450ms「処理中」演出 perch を挟む
 * - boost モード（transition 300ms ease-in、歩行の十数倍速）で残り距離を一気に走り抜ける
 *   「歩く → 全速力で走る」のスピード感ギャップを transition の差で表現
 * - 離脱完了で onComplete を呼ぶ（lastExport 記録、badge unmount）
 *
 * 二層構造：
 * - 外側 div: translateX で水平スライド（歩行）
 * - 内側 button: translateY で wobble（揺れ）
 * - 両 transform を別要素で合成し、互いに干渉しないようにする
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

type Phase = "hidden" | "walking";
/** 動作モード：normal=通常歩行 / paused=タップで停止中 / boost=バックアップ完了後の高速離脱 */
type Mode = "normal" | "paused" | "boost";

/** 駐機・往復で使う off-screen 位置（vw 単位）。viewport center 基準で十分にはみ出る値 */
const OFFSCREEN_VW = 60;
/** 通常歩行の所要時間（ms）。off-left → off-right を linear に進む */
const WALK_DURATION_MS = 10_000;
/** boost 離脱の transition 時間（ms）。歩行との比は約 33 倍、「全速力で走る」感を演出 */
const BOOST_DURATION_MS = 300;
/** タップ → ファイル書き出し → 離脱開始までの「処理中」 perch（ms） */
const PROCESSING_PAUSE_MS = 450;
/** 出現間隔のランダム範囲（ms）：30〜120 秒 */
const HIDDEN_MIN_MS = 30_000;
const HIDDEN_RAND_RANGE_MS = 90_000;

function phaseDurationMs(phase: Phase, mode: Mode): number {
  if (phase === "hidden") return HIDDEN_MIN_MS + Math.floor(Math.random() * HIDDEN_RAND_RANGE_MS);
  // walking: 通常は WALK_DURATION_MS、boost 時は BOOST_DURATION_MS
  return mode === "boost" ? BOOST_DURATION_MS : WALK_DURATION_MS;
}

export function BackupBadge({ onSave, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("hidden");
  // true: 左から右へ歩行 / false: 右から左へ歩行。サイクル毎に反転
  const [leftToRight, setLeftToRight] = useState<boolean>(() => Math.random() < 0.5);
  const [mode, setMode] = useState<Mode>("normal");
  /** タップ時の現在 transform 値を実 DOM から読んで固定する（解放時 null） */
  const [frozenTransform, setFrozenTransform] = useState<string | null>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const pauseTimerRef = useRef<number | null>(null);
  // onComplete は phase 駆動 useEffect の依存に巻き込まないよう ref 経由で読む
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // phase 駆動タイマー。paused 中は時計を止める
  useEffect(() => {
    if (mode === "paused") return;
    const ms = phaseDurationMs(phase, mode);
    const t = window.setTimeout(() => {
      if (phase === "walking") {
        // 歩行完了 → 次サイクル準備（出口側 = 次の進入側のため leftToRight 反転）
        setLeftToRight((v) => !v);
        if (mode === "boost") {
          // boost 離脱が完了 → 通常モードに戻り、親に完了通知
          setMode("normal");
          onCompleteRef.current();
        }
        setPhase("hidden");
      } else {
        // hidden の待機完了 → 歩行開始
        setPhase("walking");
      }
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
    // hidden / paused / boost 中は再タップ無効（normal な walking のみ反応）
    if (mode !== "normal" || phase !== "walking") return;

    // 現在の transform を実 DOM から読んで凍結（mid-walk 位置を維持）
    const node = slideRef.current;
    if (node) {
      const t = getComputedStyle(node).transform;
      setFrozenTransform(t && t !== "none" ? t : "translateX(0)");
    }
    setMode("paused");

    // ファイル書き出しを同期発火（OS ダイアログまで誘導される）
    onSave();

    // 一定時間「処理中」演出 perch → boost で離脱
    pauseTimerRef.current = window.setTimeout(() => {
      pauseTimerRef.current = null;
      setFrozenTransform(null);
      setMode("boost");
      // phase は walking のまま。transition 時間が boost 用に切り替わり、残り距離を一気に走る
    }, PROCESSING_PAUSE_MS);
  }

  // 水平スライドの translateX：
  // - hidden: 待機側（次サイクルの進入側）に駐機
  // - walking/boost: 出口側へ向かう（leftToRight=true なら +OFFSCREEN_VW、false なら -OFFSCREEN_VW）
  const targetVw = leftToRight ? OFFSCREEN_VW : -OFFSCREEN_VW;
  const parkedVw = leftToRight ? -OFFSCREEN_VW : OFFSCREEN_VW;
  const translateVw = phase === "hidden" ? parkedVw : targetVw;
  const transformStyle = frozenTransform ?? `translateX(${translateVw}vw)`;

  // CSS transition：paused は none で固定、boost は短時間 ease-in、それ以外は linear で walking 速度
  let transitionStyle: string;
  if (mode === "paused") transitionStyle = "none";
  else if (mode === "boost") transitionStyle = `transform ${BOOST_DURATION_MS}ms ease-in`;
  else transitionStyle = `transform ${WALK_DURATION_MS}ms linear`;

  // 上下の「ふわふわ」揺れ：normal な walking でのみ作動。paused は中間フレームで停止、boost は揺れなし
  let wobbleClass: string;
  if (mode === "normal" && phase === "walking") wobbleClass = "animate-shimaenaga-float";
  else if (mode === "paused")
    wobbleClass = "animate-shimaenaga-float animate-shimaenaga-float-paused";
  else wobbleClass = "";

  const isHidden = phase === "hidden";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center safe-top">
      <div
        ref={slideRef}
        className="mt-2"
        style={{ transform: transformStyle, transition: transitionStyle }}
      >
        <button
          type="button"
          onClick={handleTap}
          aria-label="バックアップを保存"
          // hidden 中はオフスクリーンに居るがフォーカス可能要素として DOM に残るため、
          // a11y ツリーから除外しキーボード Tab でも到達不能にする
          aria-hidden={isHidden || undefined}
          tabIndex={isHidden ? -1 : undefined}
          className={`pointer-events-auto w-12 h-12 flex items-center justify-center ${wobbleClass}`}
        >
          <img src={shimaenagaImg} alt="" className="w-12 h-12 select-none" draggable={false} />
        </button>
      </div>
    </div>
  );
}
