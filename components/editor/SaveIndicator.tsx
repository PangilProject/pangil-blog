"use client";

import { useEffect, useState } from "react";

import type { AutosaveState } from "@/lib/editor/autosave";
import { cn } from "@/lib/utils";

/**
 * 저장 인디케이터 (03 §6.2 · ADR-006) — "신뢰의 시각화"(02 §3.4).
 *
 * **네 에디터가 같은 문구를 쓴다.** 전에는 설교만 "로컬 저장됨 · 서버 저장 대기"였다 — 같은
 * 일을 에디터마다 다르게 말하면 읽는 법을 따로 익혀야 한다. 로컬 미러는 늘 돌지만 여기서는
 * 말하지 않는다. 이 표시는 **서버 임시저장**만 말한다.
 *
 * 여기서 상태를 만들지 않는다. 받은 상태를 그리기만 한다.
 */

export type SaveIndicatorProps = {
  state: AutosaveState;
  /** 마지막 서버 저장 시각 — `임시저장됨 · 3분 전` */
  savedAt?: Date | null;
  /** 서버에 이미 있는 글인가(열었을 때 고친 게 없으면 `임시저장됨`) */
  hasDraft?: boolean;
  /** 발행된 글을 고치는 중이면 서버 상태 대신 반영 여부를 말한다 */
  published?: boolean;
  /** 이 화면에서 고쳤는가 — 발행된 글에서만 본다 */
  edited?: boolean;
  className?: string;
};

type Tone = "idle" | "busy" | "ok" | "warn";

const DOT: Record<Tone, string> = {
  idle: "bg-[#cfc8b6]",
  busy: "bg-warn motion-safe:animate-pulse",
  ok: "bg-ok",
  warn: "bg-warn",
};

export function SaveIndicator({
  state,
  savedAt = null,
  hasDraft = false,
  published = false,
  edited = false,
  className,
}: SaveIndicatorProps) {
  const ago = useRelativeTime(savedAt);
  const [tone, label] = describe({ state, ago, hasDraft, published, edited });

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 font-typewriter text-[11px] text-faint",
        className,
      )}
    >
      <span aria-hidden className={cn("size-[7px] rounded-full", DOT[tone])} />
      {label}
    </span>
  );
}

function describe({
  state,
  ago,
  hasDraft,
  published,
  edited,
}: {
  state: AutosaveState;
  ago: string | null;
  hasDraft: boolean;
  published: boolean;
  edited: boolean;
}): [Tone, string] {
  // 발행된 글은 서버에 올리지 않는다 — 반영은 발행 버튼만 한다(ADR-006)
  if (published) return edited ? ["warn", "수정 중 · 발행해야 반영돼요"] : ["ok", "발행된 글"];

  switch (state) {
    case "saving":
      return ["busy", "저장 중…"];
    case "saved":
      return ["ok", ago ? `임시저장됨 · ${ago}` : "임시저장됨"];
    case "retrying":
      return ["warn", "저장 실패 · 잠시 후 다시 시도"];
    case "typing":
      return ["idle", "저장 안 됨"];
    default:
      return hasDraft ? ["ok", "임시저장됨"] : ["idle", "저장 안 됨"];
  }
}

/** `방금` · `3분 전` · `1시간 전` — 30초마다 다시 센다 */
function useRelativeTime(at: Date | null): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!at) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [at]);

  if (!at) return null;
  const minutes = Math.floor((now - at.getTime()) / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  return `${Math.floor(minutes / 60)}시간 전`;
}
