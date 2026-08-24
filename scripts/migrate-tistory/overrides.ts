import type { Classified } from "@/scripts/migrate-tistory/classify";

/**
 * 글 단위 예외 (05 §6.3 "수동 = 게이트 실패분 + 검토 큐 보정 후 재투입").
 *
 * 티스토리에서 카테고리를 지정하지 않았거나 "미사용"에 넣어둔 32편이다. 규칙으로는 판정할
 * 수 없고 — 실제로 서식과 진짜 글이 섞여 있었다 — 사용자가 하나씩 정한 결과를 여기 적는다.
 *
 * 이 표가 코드에 있는 이유: 이관은 여러 번 다시 돌린다. 그때마다 같은 판단을 손으로
 * 반복하면 매번 조금씩 달라진다.
 */

const SCHOOL = [
  134, // 오리엔테이션
  163, // 입사지원서 작성방법 특강
  166, // Career-ing(취업동아리) OT
  167, // [일지] 240311
  168, // [일지] 240312
  330, // EAP Oraltest
  69, // 업무 일지, 과연 얼마나 쓸 수 있을까?
  71, // [캡스톤] 2월 12일 업무일지
  85, // [캡스톤] 2월 13일 업무일지
  102, // [캡스톤] 2월 18일 업무일지
];

/** 코테·문제 풀이 모음 */
const DEV = [
  124, // hackerrank 문제
  416, // 백준
  629, // 백준 v2
  622, // [re-log] 대시보드 페이지 리팩토링
];

/** 내용이 "26년도 N월", 빈 불릿뿐인 틀. 발행하면 빈 글이 공개된다 */
const TEMPLATES = [
  4, // [묵상 서식]
  10, // [설교 서식]
  17, // [찬양 서식]
  66, // [타입스크립트] 서식
  70, // [캡스톤] 서식
  95, // 정보 공유 서식 : 영상 제목
  660, // [회고] 월간 회고
  661, // [회고] 주간 회고
  662, // [회고] 월간 목표
];

type Resolved = Classified;

const BY_LEGACY_ID = new Map<number, Resolved>([
  // faith — 카테고리를 빼먹고 올린 글들
  [519, { kind: "post", site: "faith", type: "QT", categorySlug: null }],
  [137, { kind: "post", site: "faith", type: "SERMON", categorySlug: null }], // 수요 채플
  [523, { kind: "post", site: "faith", type: "PRAISE", categorySlug: null }], // 어노인팅 9집
  // dev — 카테고리만 정해주면 되는 글들
  [542, { kind: "post", site: "dev", type: "TECH", categorySlug: "infra" }], // Amazon S3
  [556, { kind: "post", site: "dev", type: "TECH", categorySlug: "cs" }], // 프로그래밍 언어 활용
  [557, { kind: "post", site: "dev", type: "TECH", categorySlug: "cs" }], // 정보처리기사 실기
  [568, { kind: "post", site: "dev", type: "TECH", categorySlug: "retrospective" }], // 우테코 회고
  [640, { kind: "post", site: "dev", type: "TECH", categorySlug: "info" }], // 커피 리뷰
  [641, { kind: "post", site: "dev", type: "TECH", categorySlug: "info" }], // 개발자라면 - 커피리뷰
  ...SCHOOL.map(
    (id) =>
      [id, { kind: "post", site: "dev", type: "TECH", categorySlug: "school" }] as [
        number,
        Resolved,
      ],
  ),
  ...DEV.map(
    (id) =>
      [id, { kind: "post", site: "dev", type: "TECH", categorySlug: "dev" }] as [number, Resolved],
  ),
  ...TEMPLATES.map((id) => [id, { kind: "exclude", reason: "서식·빈 틀" }] as [number, Resolved]),
]);

export function overrideFor(legacyId: number): Resolved | null {
  return BY_LEGACY_ID.get(legacyId) ?? null;
}
