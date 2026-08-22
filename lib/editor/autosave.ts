/**
 * 자동 저장 상태 기계 (04 §2.2) — 전 에디터 공통.
 *
 *   idle ─입력─▶ typing ─debounce 1s (maxWait 5s)─▶ saving ─▶ saved
 *                                                     │실패
 *                                                     ▼
 *                                           retrying (백오프 2s→5s→10s, 더티 유지)
 *
 * 설계 이유:
 * - **maxWait 5s가 필수다.** 설교 라이브 속기처럼 계속 타이핑하면 debounce가 영원히 안 터진다.
 *   그 상태로 탭이 닫히면 그날 예배 노트가 사라진다(프리모템 #2)
 * - **낙관적 저장.** 즉시 "저장 중…"을 보여주고 실패했을 때만 되돌린다
 * - **포기하지 않는다.** 백오프는 10초에서 멈추고 계속 재시도한다. 더티 값은 유지된다 —
 *   재시도를 포기하는 순간 그 글은 유실이다
 * - **마지막 값만 보낸다.** 저장 중에 들어온 입력은 합쳐서 다음 한 번으로 보낸다
 *
 * React에 의존하지 않는다. 타이머를 주입받아 테스트에서 시간을 통제한다.
 */

export type AutosaveState = "idle" | "typing" | "saving" | "saved" | "retrying";

export type AutosaveOptions<T> = {
  /** 실제 저장(Server Action). 예외를 던지면 실패로 본다 */
  save: (value: T) => Promise<void>;
  onStateChange?: (state: AutosaveState) => void;
  /** 마지막 저장 성공 시각 */
  onSaved?: (at: Date) => void;
  onError?: (error: unknown) => void;
  debounceMs?: number;
  maxWaitMs?: number;
  backoffMs?: number[];
  now?: () => number;
};

export const DEFAULT_DEBOUNCE_MS = 1000;
export const DEFAULT_MAX_WAIT_MS = 5000;
/** 마지막 값에서 멈춘 뒤 계속 재시도한다 */
export const DEFAULT_BACKOFF_MS = [2000, 5000, 10000];

export type Autosave<T> = {
  /** 입력이 들어왔다 */
  change(value: T): void;
  /** 임시저장 버튼·발행 직전 — debounce를 건너뛰고 즉시 저장한다 */
  flush(): Promise<void>;
  state(): AutosaveState;
  /** 아직 서버에 안 올라간 값이 있는지 */
  isDirty(): boolean;
  dispose(): void;
};

export function createAutosave<T>(options: AutosaveOptions<T>): Autosave<T> {
  const {
    save,
    onStateChange,
    onSaved,
    onError,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    maxWaitMs = DEFAULT_MAX_WAIT_MS,
    backoffMs = DEFAULT_BACKOFF_MS,
    now = () => Date.now(),
  } = options;

  let state: AutosaveState = "idle";
  let pending: { value: T } | null = null;
  let inFlight: Promise<void> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let firstChangeAt: number | null = null;
  let failureCount = 0;
  let disposed = false;

  function setState(next: AutosaveState) {
    if (state === next) return;
    state = next;
    onStateChange?.(next);
  }

  function clearTimer(timer: ReturnType<typeof setTimeout> | null) {
    if (timer) clearTimeout(timer);
    return null;
  }

  function clearScheduling() {
    debounceTimer = clearTimer(debounceTimer);
    maxWaitTimer = clearTimer(maxWaitTimer);
    firstChangeAt = null;
  }

  function schedule() {
    debounceTimer = clearTimer(debounceTimer);
    debounceTimer = setTimeout(() => void run(), debounceMs);

    // maxWait는 최초 입력 시각부터 한 번만 걸어둔다. 계속 타이핑해도 이건 터진다
    if (firstChangeAt === null) {
      firstChangeAt = now();
      maxWaitTimer = setTimeout(() => void run(), maxWaitMs);
    }
  }

  async function run(): Promise<void> {
    if (disposed) return;
    clearScheduling();

    // 저장 중이면 지금 값은 다음 차례로 넘긴다 (마지막 값만 보낸다)
    if (inFlight) return inFlight.then(() => (pending ? run() : undefined));
    if (!pending) return;

    const attempt = pending;
    pending = null;
    setState("saving");

    inFlight = (async () => {
      try {
        await save(attempt.value);
        failureCount = 0;
        setState(pending ? "typing" : "saved");
        onSaved?.(new Date(now()));
      } catch (error) {
        // 더티 값을 되돌려 놓는다 — 실패한 값을 버리면 그게 유실이다
        pending = pending ?? attempt;
        failureCount += 1;
        setState("retrying");
        onError?.(error);
        scheduleRetry();
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  }

  function scheduleRetry() {
    if (disposed) return;
    const delay = backoffMs[Math.min(failureCount - 1, backoffMs.length - 1)] ?? 0;
    retryTimer = clearTimer(retryTimer);
    retryTimer = setTimeout(() => void run(), delay);
  }

  return {
    change(value: T) {
      if (disposed) return;
      pending = { value };
      if (state !== "retrying") setState("typing");
      schedule();
    },

    async flush() {
      if (disposed) return;
      retryTimer = clearTimer(retryTimer);
      await run();
    },

    state: () => state,
    isDirty: () => pending !== null || inFlight !== null,

    dispose() {
      disposed = true;
      clearScheduling();
      retryTimer = clearTimer(retryTimer);
    },
  };
}
