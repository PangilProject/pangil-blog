"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type AutosaveState, createAutosave } from "@/lib/editor/autosave";
import { createLocalMirror, type MirrorSnapshot } from "@/lib/editor/localMirror";

/**
 * 에디터 저장 배선 (04 §2.2·§2.3).
 *
 * 두 계층을 한 훅에서 묶는다.
 * 1. 입력 즉시 로컬 미러에 스냅샷 (네트워크와 무관)
 * 2. 자동 저장 상태 기계가 debounce/maxWait/백오프로 서버에 올림
 *
 * 설교(로컬 우선)와 나머지 에디터의 차이는 **표시 문구**뿐이다(SaveIndicator variant).
 * 저장 순서는 어차피 로컬이 먼저다 — 그게 프리모템 #2의 방어선이고, 전 에디터에 적용된다.
 */

export type UseEditorAutosaveOptions<T> = {
  /** 미러 키 구성용 — draft:{type}:{id} */
  type: string;
  id: string;
  /** 서버 저장. 예외를 던지면 재시도한다 */
  save: (value: T) => Promise<void>;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length"> | null;
};

export type UseEditorAutosaveResult<T> = {
  state: AutosaveState;
  savedAt: Date | null;
  /** 입력이 들어왔을 때 호출 */
  onChange: (value: T) => void;
  /** 임시저장 버튼·발행 직전 */
  flush: () => Promise<void>;
  /** 마운트 시점에 발견된 미동기화 로컬 스냅샷 (복구 배너용) */
  recovery: MirrorSnapshot<T> | null;
  dismissRecovery: () => void;
  /** 발행 완료 등 — 미러를 비운다 */
  clearMirror: () => void;
};

export function useEditorAutosave<T>({
  type,
  id,
  save,
  storage,
}: UseEditorAutosaveOptions<T>): UseEditorAutosaveResult<T> {
  const [state, setState] = useState<AutosaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [recovery, setRecovery] = useState<MirrorSnapshot<T> | null>(null);

  // 저장 함수가 매 렌더 바뀌어도 상태 기계를 다시 만들지 않는다
  const saveRef = useRef(save);
  saveRef.current = save;

  const mirror = useMemo(() => {
    const resolved = storage === undefined ? globalThis.localStorage : storage;
    if (!resolved) return null;
    return createLocalMirror<T>({ type, id, storage: resolved });
  }, [type, id, storage]);

  // 마지막으로 로컬에 남긴 rev — 서버 저장이 성공하면 여기까지 동기화됐다고 표시한다
  const pendingRevRef = useRef(0);

  const autosave = useMemo(
    () =>
      createAutosave<T>({
        save: async (value) => {
          const revAtSend = pendingRevRef.current;
          await saveRef.current(value);
          mirror?.markSynced(revAtSend);
        },
        onStateChange: setState,
        onSaved: setSavedAt,
      }),
    [mirror],
  );

  // 마운트 시 미동기화 로컬 스냅샷이 있으면 복구 배너를 띄운다(04 §2.3)
  useEffect(() => {
    if (!mirror?.hasUnsyncedChanges()) return;
    setRecovery(mirror.read());
  }, [mirror]);

  // 오프라인에서 쌓인 것을 온라인 복귀 시 즉시 밀어 올린다
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onOnline = () => void autosave.flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [autosave]);

  useEffect(() => () => autosave.dispose(), [autosave]);

  const onChange = useCallback(
    (value: T) => {
      // 로컬이 먼저다. 네트워크가 죽어도 이 줄은 성공한다
      const snapshot = mirror?.write(value);
      if (snapshot) pendingRevRef.current = snapshot.rev;
      autosave.change(value);
    },
    [autosave, mirror],
  );

  return {
    state,
    savedAt,
    onChange,
    flush: useCallback(() => autosave.flush(), [autosave]),
    recovery,
    dismissRecovery: useCallback(() => setRecovery(null), []),
    clearMirror: useCallback(() => mirror?.clear(), [mirror]),
  };
}
