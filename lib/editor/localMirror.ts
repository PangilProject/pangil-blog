/**
 * 로컬 보존 계층 (04 §2.3).
 *
 * 두 계층이 있다.
 * 1. **보험 미러(전 에디터)**: 저장 파이프라인과 별개로 입력 즉시 localStorage에 스냅샷.
 *    서버 저장이 성공하면 그 rev를 동기화 완료로 표시한다
 * 2. **로컬 우선(설교만)**: 로컬이 진실의 원천이다. 서버는 백그라운드 백업이고, 실패해도
 *    "로컬 저장됨 · 동기화 대기"로 정상 동작한다(프리모템 #2)
 *
 * 알려진 한계: localStorage는 기기 로컬이라 설교는 단일 기기 전제다. 크로스기기
 * 이어쓰기는 서버 동기화가 성공했을 때만 가능하다 — 버그가 아니라 로컬 우선의 트레이드오프.
 *
 * 저장소를 주입받아 테스트한다. IndexedDB는 채택하지 않았다(글 수십 KB ≪ 5MB).
 */

export type MirrorSnapshot<T> = {
  /** 로컬 수정 횟수. 서버 동기화 여부를 이 숫자로 판단한다 */
  rev: number;
  /** 서버에 올라간 마지막 rev. 아직 못 올렸으면 null */
  syncedRev: number | null;
  value: T;
  updatedAt: string;
};

/** localStorage의 필요한 부분만 (테스트에서 갈아끼운다) */
export type MirrorStorage = {
  length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const MIRROR_KEY_PREFIX = "draft:";

export function mirrorKey(type: string, id: string): string {
  return `${MIRROR_KEY_PREFIX}${type}:${id}`;
}

export type LocalMirrorOptions = {
  type: string;
  id: string;
  storage: MirrorStorage;
  now?: () => Date;
  /** 용량이 찼을 때 정리한 키를 알린다 */
  onPrune?: (keys: string[]) => void;
};

export type LocalMirror<T> = {
  read(): MirrorSnapshot<T> | null;
  /** 입력 즉시 호출. rev를 올리고 스냅샷을 남긴다 */
  write(value: T): MirrorSnapshot<T>;
  /** 서버 저장 성공. 그 rev까지 동기화됐다고 표시한다 */
  markSynced(rev: number): void;
  /** 아직 서버에 못 올린 로컬 변경이 있는가 — 복구 배너의 판단 기준 */
  hasUnsyncedChanges(): boolean;
  clear(): void;
};

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

export function createLocalMirror<T>({
  type,
  id,
  storage,
  now = () => new Date(),
  onPrune,
}: LocalMirrorOptions): LocalMirror<T> {
  const key = mirrorKey(type, id);

  function read(): MirrorSnapshot<T> | null {
    const raw = storage.getItem(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as MirrorSnapshot<T>;
    } catch {
      // 깨진 스냅샷은 없는 것으로 본다. 서버 값으로 시작하는 편이 안전하다
      return null;
    }
  }

  function persist(snapshot: MirrorSnapshot<T>) {
    const payload = JSON.stringify(snapshot);

    try {
      storage.setItem(key, payload);
    } catch (error) {
      if (!isQuotaError(error)) throw error;

      // 다른 초안의 오래된 미러부터 비운다. 지금 쓰는 글이 최우선이다
      const pruned = pruneOtherMirrors(storage, key);
      onPrune?.(pruned);
      storage.setItem(key, payload);
    }
  }

  return {
    read,

    write(value: T) {
      const previous = read();
      const snapshot: MirrorSnapshot<T> = {
        rev: (previous?.rev ?? 0) + 1,
        syncedRev: previous?.syncedRev ?? null,
        value,
        updatedAt: now().toISOString(),
      };

      persist(snapshot);
      return snapshot;
    },

    markSynced(rev: number) {
      const snapshot = read();
      if (!snapshot) return;
      persist({ ...snapshot, syncedRev: Math.max(rev, snapshot.syncedRev ?? 0) });
    },

    hasUnsyncedChanges() {
      const snapshot = read();
      if (!snapshot) return false;
      return snapshot.rev > (snapshot.syncedRev ?? 0);
    },

    clear() {
      storage.removeItem(key);
    },
  };
}

/** 다른 초안 미러를 오래된 순으로 비운다 */
function pruneOtherMirrors(storage: MirrorStorage, keepKey: string): string[] {
  const candidates: { key: string; updatedAt: string }[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const candidate = storage.key(index);
    if (!candidate || candidate === keepKey || !candidate.startsWith(MIRROR_KEY_PREFIX)) continue;

    const raw = storage.getItem(candidate);
    let updatedAt = "";
    try {
      updatedAt = (JSON.parse(raw ?? "{}") as { updatedAt?: string }).updatedAt ?? "";
    } catch {
      updatedAt = "";
    }

    candidates.push({ key: candidate, updatedAt });
  }

  candidates.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

  const pruned: string[] = [];
  for (const candidate of candidates) {
    storage.removeItem(candidate.key);
    pruned.push(candidate.key);
  }

  return pruned;
}
