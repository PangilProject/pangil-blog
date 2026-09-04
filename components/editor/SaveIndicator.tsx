import type { AutosaveState } from "@/lib/editor/autosave";
import { cn } from "@/lib/utils";

/**
 * 저장 인디케이터 (03 §6.2 · 04 §2.2) — "신뢰의 시각화"(02 §3.4).
 *
 * 점 색으로만 상태를 말한다: 회색 대기 / 호박 저장 중·동기화 대기 / 녹색 저장됨(03 §4).
 * 설교 에디터는 로컬이 진실의 원천이라(04 §2.3) 서버 동기화가 실패해도 "로컬 저장됨 ·
 * 동기화 대기"로 정상 동작해야 한다 — 그래서 variant가 갈린다.
 *
 * 여기서 상태를 만들지 않는다. 상태 기계는 M2 자동 저장 파이프라인의 몫이고,
 * 이 컴포넌트는 받은 상태를 그리기만 한다.
 */

export type SaveState = "idle" | "typing" | "saving" | "saved" | "offline-pending";

/**
 * 저장 상태 기계(04 §2.2)의 상태를 화면 상태(03 §6.2)로 옮긴다.
 *
 * 기계의 "retrying"은 화면에서 "서버 저장 대기"다 — `동기화`는 구현 용어이므로 쓰지 않는다
 * (03 §7.3). 재시도 중이라는 내부 사정이 아니라
 * "아직 서버에 못 올렸다"는 사실을 보여주는 게 작성자에게 필요한 정보다.
 */
export function toSaveState(state: AutosaveState): SaveState {
  return state === "retrying" ? "offline-pending" : state;
}

export type SaveIndicatorVariant = "default" | "sermon";

const DOT_BY_STATE: Record<SaveState, string> = {
  idle: "bg-[#cfc8b6]",
  typing: "bg-[#cfc8b6]",
  saving: "bg-warn motion-safe:animate-pulse",
  saved: "bg-ok",
  "offline-pending": "bg-warn",
};

const LABEL_BY_STATE: Record<SaveState, string> = {
  idle: "저장 대기",
  typing: "입력 중",
  saving: "저장 중…",
  saved: "저장됨",
  "offline-pending": "서버 저장 대기",
};

/** 설교는 로컬 우선이라 같은 상태도 다르게 말한다 — 실패가 아니라 정상 동작이다 */
const SERMON_LABEL_OVERRIDES: Partial<Record<SaveState, string>> = {
  saved: "로컬 저장됨",
  "offline-pending": "로컬 저장됨 · 서버 저장 대기",
};

export type SaveIndicatorProps = {
  state: SaveState;
  variant?: SaveIndicatorVariant;
  /** "방금", "2분 전" 같은 상대 시각. 저장됨 상태에서만 의미가 있다 */
  savedAgo?: string;
  className?: string;
};

export function SaveIndicator({
  state,
  variant = "default",
  savedAgo,
  className,
}: SaveIndicatorProps) {
  const label =
    (variant === "sermon" ? SERMON_LABEL_OVERRIDES[state] : undefined) ?? LABEL_BY_STATE[state];

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 font-typewriter text-[11px] text-faint",
        className,
      )}
    >
      <span aria-hidden className={cn("size-[7px] rounded-full", DOT_BY_STATE[state])} />
      {state === "saved" && savedAgo ? `${label} · ${savedAgo}` : label}
    </span>
  );
}
