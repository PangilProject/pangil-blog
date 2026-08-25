import {
  FIRST_BACKUP_OVERRIDES,
  type Resolved,
  SECOND_BACKUP_OVERRIDES,
} from "@/scripts/migrate-tistory/overrides";

/**
 * 백업이 둘이다 (05 §6 정정 — 2026-08-25).
 *
 * 묵상은 2025-09-21에 두 번째 티스토리 블로그로 옮겨갔고 기술 글만 첫 블로그에 남았다.
 * 그래서 백업이 두 벌인데, **원본 글 ID가 1부터 다시 시작한다** — 두 백업의 134번은 서로
 * 다른 글이다. legacyId는 재실행 멱등 키이자 unique 열이므로(05 §6.4-7) 그대로 두면
 * 두 번째 백업이 통째로 "이미 있음"으로 건너뛰어진다.
 *
 * 그래서 백업마다 오프셋을 준다. 그리고 **글 단위 예외 표도 백업마다 따로 쥔다** — 첫
 * 백업의 예외(134번은 학교 일지다)가 두 번째 백업의 134번(주일 예배 설교)에 붙는 것을
 * dry-run에서 실제로 봤다.
 */
export type Backup = {
  key: string;
  label: string;
  /** DB legacyId = idOffset + 원본 글 ID */
  idOffset: number;
  overrides: Map<number, Resolved>;
};

export const BACKUPS: Backup[] = [
  {
    key: "log-1",
    label: "첫 블로그 (기술 + 2025-09 이전 묵상)",
    idOffset: 0,
    overrides: FIRST_BACKUP_OVERRIDES,
  },
  {
    key: "log-2",
    label: "두 번째 블로그 (2025-09-21 이후 묵상)",
    idOffset: 10_000,
    overrides: SECOND_BACKUP_OVERRIDES,
  },
];

export function backupOf(key: string | undefined): Backup | null {
  return BACKUPS.find((backup) => backup.key === key) ?? null;
}

/** 사용법 안내에 쓰는 한 줄 */
export function backupKeyList(): string {
  return BACKUPS.map((backup) => `${backup.key}(${backup.label})`).join(" · ");
}
