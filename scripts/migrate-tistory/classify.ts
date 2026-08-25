import type { RecordType } from "@/lib/record/callNumber";

/**
 * 카테고리 → site·타입·분류 (05 §6.2를 실물로 정정).
 *
 * 문서는 "블로그별 zip이 site 1차 분기"라고 봤지만, 실제 백업 하나에 묵상과 기술이 섞여
 * 있다. 그래서 site는 카테고리로 가른다 — 다행히 본문 신호 추측보다 훨씬 정확하다.
 *
 * 백업의 카테고리 텍스트에는 이모지가 `?`로 깨져 들어온다(티스토리 내보내기가 4바이트
 * 문자를 버린다). 그래서 **한글·영문 부분만 남겨** 비교한다 — 이모지에 의존하면 다음
 * 백업에서 또 깨진다.
 */

export type MigrationSite = "faith" | "dev";

export type Classified =
  | {
      kind: "post";
      site: MigrationSite;
      type: RecordType;
      /** TECH만 씀. faith는 카테고리를 쓰지 않는다(02 §4) */
      categorySlug: string | null;
    }
  /** 규칙이 판정하지 못했다. 이 수가 0이 아니면 아직 이관할 준비가 안 된 것이다 */
  | { kind: "review"; reason: string }
  /** 일부러 안 가져온다(서식·빈 틀). 판정 실패와 구분해야 리포트를 믿을 수 있다 */
  | { kind: "exclude"; reason: string };

/** 깨진 이모지·기호를 털어낸 이름 */
function clean(segment: string): string {
  return segment
    .replace(/[^\p{Script=Hangul}\p{L}\p{N}\s()\-.+#/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** TECH 상위 카테고리 → 우리 카테고리 slug (사용자 확인, 2026-08-25) */
const TECH_CATEGORY_SLUGS: Record<string, string> = {
  FE: "fe",
  BE: "be",
  개발: "dev",
  프로젝트: "dev",
  회고: "retrospective",
  "정보 공유": "info",
  한동대학교: "school",
};

/** BE 아래지만 실은 인프라인 것들 */
const INFRA_SUBS = ["K9s", "Docker", "AWS"];

export function classify(categoryPath: string): Classified {
  const segments = categoryPath.split("/").map(clean).filter(Boolean);

  if (segments.length === 0) {
    // 티스토리에서 카테고리를 안 골랐다. 서식과 진짜 글이 섞여 있어 규칙으로는 못 가른다 —
    // overrides가 글 단위로 정한다
    return { kind: "review", reason: "카테고리 없음" };
  }

  const [top, sub = ""] = segments;

  /**
   * 두 번째 블로그는 묵상만 담으므로 `묵상/` 상위가 없다 — QT·설교가 최상위다(2026-08-25).
   * 첫 블로그의 `묵상/QT`도 계속 받는다: 백업 둘을 같은 규칙으로 읽어야 한다.
   */
  if (top === "QT") return { kind: "post", site: "faith", type: "QT", categorySlug: null };
  if (top === "설교") return { kind: "post", site: "faith", type: "SERMON", categorySlug: null };

  // 세이레 특별새벽기도회 — 새벽예배 설교다(사용자 확인, 2026-08-25)
  if (top.includes("세이레")) {
    return { kind: "post", site: "faith", type: "SERMON", categorySlug: null };
  }

  if (top === "묵상") {
    if (sub.includes("QT")) return { kind: "post", site: "faith", type: "QT", categorySlug: null };
    if (sub.includes("설교")) {
      return { kind: "post", site: "faith", type: "SERMON", categorySlug: null };
    }
    return { kind: "review", reason: `묵상 하위 분류를 모릅니다: "${sub || "(없음)"}"` };
  }

  if (top === "찬양") {
    // 하위(어노인팅·마커스·FIA…)는 앨범·팀 이름이고 타입은 하나다
    return { kind: "post", site: "faith", type: "PRAISE", categorySlug: null };
  }

  if (top === "미사용") {
    return { kind: "review", reason: `미사용 카테고리: "${sub || "(없음)"}"` };
  }

  const slug = TECH_CATEGORY_SLUGS[top];
  if (!slug) return { kind: "review", reason: `모르는 카테고리: "${top}"` };

  const categorySlug =
    top === "BE" && INFRA_SUBS.some((name) => sub.includes(name)) ? "infra" : slug;

  return { kind: "post", site: "dev", type: "TECH", categorySlug };
}
