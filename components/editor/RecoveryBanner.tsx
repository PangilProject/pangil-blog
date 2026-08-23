"use client";

import { Button } from "@/components/ui/button";

/**
 * 복구 배너 (04 §2.3).
 *
 * 마운트 시 서버에 안 올라간 로컬 스냅샷이 있으면 띄운다. 조용히 로컬 값으로 덮어쓰지 않는다 —
 * 어느 쪽을 남길지는 작성자가 정할 문제다. 다만 기본값은 "복원"이 눈에 먼저 들어오게 둔다
 * (프리모템 #2: 유실 쪽이 훨씬 비싸다).
 */
export function RecoveryBanner({
  savedAt,
  onRestore,
  onDismiss,
}: {
  /** 로컬 스냅샷 시각 */
  savedAt?: string;
  onRestore: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex w-full max-w-[720px] flex-wrap items-center gap-3 border border-warn bg-postit px-4 py-3"
    >
      <p className="flex-1 text-[13px] text-ink">
        저장 안 된 내용이 있어요{savedAt && <span className="text-ink-soft"> · {savedAt}</span>}
      </p>
      <Button size="sm" variant="primary" onClick={onRestore}>
        복원
      </Button>
      <Button size="sm" onClick={onDismiss}>
        서버 버전 유지
      </Button>
    </div>
  );
}
