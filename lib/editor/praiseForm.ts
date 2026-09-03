import { nanoid } from "nanoid";
import { z } from "zod";

import type { DraftContent, PostContent } from "@/lib/content/schema";
import { EMPTY_TIPTAP_DOC, PRAISE_SECTION_LABELS } from "@/lib/content/schema";
import {
  EMPTY_RICH_TEXT,
  isEmptyDoc,
  type RichTextValue,
  toTiptapDoc,
} from "@/lib/editor/richText";
import { parseYouTubeId } from "@/lib/praise/youtube";

/**
 * A-06 찬양 에디터의 폼 계약 (02 §5.4 · 04 §2.5).
 *
 * 핵심 규칙 하나: **순서는 배열 인덱스가 유일한 진실이다.** order 필드를 두지 않는다 —
 * 두 곳에 순서가 있으면 드래그 한 번에 어긋난다.
 *
 * 라벨은 폼에서 평평한 문자열로 다룬다. 저장 계약의 enum | { custom } 분기는 조립 함수
 * 한 곳에서만 만든다(05 §2). 폼 안에서 분기를 들고 다니면 인라인 드롭다운이 두 갈래가 된다.
 *
 * Verse 넘버링은 저장하지 않는다. 같은 라벨의 등장 순서에서 파생 계산한다 —
 * 저장하면 블록을 옮길 때마다 다시 매기는 코드가 필요하고, 그게 곧 어긋남의 출처다.
 */

export type PraiseSectionFormValue = {
  /** 배열 재정렬에도 살아남는 키. React key와 dnd-kit이 함께 쓴다 */
  id: string;
  label: string;
  /** 빈 섹션 허용 — "16 Bar"처럼 연주 메모만 있는 섹션이 실제로 있다(02 §5.4) */
  lyrics: string;
};

export type PraiseFormValues = {
  title: string;
  youtubeUrl: string;
  sections: PraiseSectionFormValue[];
  /** "묵상과 기도" — 가사 묵상 문단과 기도문을 한 영역에 쓴다(명칭 확정, 02 §5.4) */
  meditationAndPrayer: RichTextValue;
  /**
   * 태그는 content가 아니라 태그 테이블에 산다(05 §1.4). 지면은 글 타입에서 나오므로
   * faith 글의 태그는 faith 지면에 쌓인다 — 여기서 지면을 들고 다니지 않는다.
   */
  tags: string[];
};

export const DEFAULT_SECTION_LABEL = "Verse";

/**
 * 가사가 없는 라벨 (02 §5.4의 "16 Bar" 같은 연주 구간).
 *
 * 여기에 가사 칸을 주면 늘 빈 칸이 남는다. 대신 마디 수만 받고, 저장은 기존 lyrics 문자열에
 * `"4 Bar"`로 싣는다 — 필드를 새로 파면 저장 계약·공개 지면·이관 컨버터가 함께 흔들리는데,
 * 얻는 것은 문자열 하나를 숫자로 두는 것뿐이다. 라벨을 Verse로 되돌리면 적어둔 값이
 * 그대로 가사 칸의 글자로 남는다 — 잃는 게 없다.
 */
export const BAR_ONLY_LABELS = ["Intro", "Interlude", "Outro"] as const;

export function isBarOnlyLabel(label: string): boolean {
  return BAR_ONLY_LABELS.some((candidate) => candidate === label);
}

const BAR_PATTERN = /^(\d+)\s*bar$/i;

/**
 * 마디 수 읽기. 빈 값은 "", 마디 표기는 숫자만, **그 밖의 글자는 null**이다.
 *
 * null이 중요하다 — 이관해 온 Intro에 연주 메모가 문장으로 적혀 있을 수 있고, 그걸 숫자
 * 칸에 끼우면 화면에 안 보이는 채로 다음 타이핑에 지워진다. null이면 가사 칸을 그대로 쓴다.
 */
export function parseBarCount(lyrics: string): string | null {
  const trimmed = lyrics.trim();
  if (trimmed === "") return "";
  const matched = BAR_PATTERN.exec(trimmed);
  return matched ? (matched[1] ?? "") : null;
}

/** 숫자만 남겨 저장 문자열로. 0은 마디가 아니므로 빈 값과 같이 다룬다 */
export function formatBarCount(count: string): string {
  const digits = count.replace(/\D/g, "").replace(/^0+/, "");
  return digits === "" ? "" : `${digits} Bar`;
}

/**
 * 새 섹션. id는 배열 안에서만 유일하면 된다(React key · dnd-kit).
 *
 * nanoid는 브라우저에서 섹션을 더할 때만 쓴다. **서버 프리렌더에서는 난수를 쓸 수 없다**
 * (Cache Components, ADR-003 — 재현되지 않는 출력이라 빌드가 거부한다). 그래서 빈 폼과
 * 저장값 복원의 id는 자리 번호로 결정적으로 만든다.
 */
export function newSection(label: string = DEFAULT_SECTION_LABEL): PraiseSectionFormValue {
  return { id: nanoid(), label, lyrics: "" };
}

/** 자리 번호로 만드는 결정적 id — 서버에서 만들어도 안전하다 */
export function sectionIdAt(index: number): string {
  return `section-${index + 1}`;
}

export function emptyPraiseForm(): PraiseFormValues {
  return {
    title: "",
    youtubeUrl: "",
    // 빈 화면을 주지 않는다. 첫 섹션은 늘 놓여 있다
    sections: [{ id: sectionIdAt(0), label: DEFAULT_SECTION_LABEL, lyrics: "" }],
    meditationAndPrayer: EMPTY_RICH_TEXT,
    tags: [],
  };
}

/**
 * 같은 라벨이 두 번 이상 나올 때만 번호를 매긴다 (04 §2.5 파생 계산).
 * Verse가 하나뿐인 곡에 "Verse 1"이라 적으면 없는 Verse 2를 암시한다.
 */
export function sectionOrdinals(sections: PraiseSectionFormValue[]): (number | undefined)[] {
  const totals = new Map<string, number>();
  for (const section of sections) {
    totals.set(section.label, (totals.get(section.label) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  return sections.map((section) => {
    const next = (seen.get(section.label) ?? 0) + 1;
    seen.set(section.label, next);
    return (totals.get(section.label) ?? 0) > 1 ? next : undefined;
  });
}

/** 라벨 7종 밖은 직접 입력으로 싣는다 (02 §5.4 — Tag·Refrain 등 예외 대응) */
function toContentLabel(label: string) {
  const known = PRAISE_SECTION_LABELS.find((candidate) => candidate === label);
  return known ?? { custom: label };
}

function fromContentLabel(label: unknown): string {
  if (typeof label === "string") return label;
  if (label && typeof label === "object" && "custom" in label) {
    return String((label as { custom: unknown }).custom ?? "");
  }
  return DEFAULT_SECTION_LABEL;
}

function toContentSections(values: PraiseFormValues) {
  return values.sections.map((section) => ({
    id: section.id,
    label: toContentLabel(section.label),
    lyrics: section.lyrics,
  }));
}

/**
 * 자동 저장용 (04 §2.2).
 *
 * youtubeUrl은 DraftSchema에서도 형식 검증을 받는다(z.url) — 그래서 아직 안 적은 상태는
 * 필드를 넣지 않는다. 반쯤 적힌 URL을 빈 문자열로 저장하면 초안 저장이 통째로 거절된다.
 */
export function toDraftContent(values: PraiseFormValues): DraftContent {
  const url = values.youtubeUrl.trim();

  return {
    kind: "PRAISE",
    ...(url === "" ? {} : { youtubeUrl: url }),
    sections: toContentSections(values),
    meditationAndPrayer: toTiptapDoc(values.meditationAndPrayer),
  };
}

/** 발행 게이트의 화면 쪽 절반. 최종 게이트는 서버의 publishPost(05 §3.4) */
export const PraisePublishFormSchema = z.object({
  title: z.string().trim().min(1, "제목을 적어주세요"),
  youtubeUrl: z
    .string()
    .trim()
    .refine((value) => parseYouTubeId(value) !== null, "유튜브 주소를 확인해 주세요"),
  sections: z
    .array(z.object({ id: z.string(), label: z.string(), lyrics: z.string() }))
    .min(1, "가사 섹션이 하나는 있어야 해요"),
  meditationAndPrayer: z.custom<RichTextValue>(
    (value) => !isEmptyDoc(value as RichTextValue),
    "묵상과 기도를 적어주세요",
  ),
});

export function toPublishContent(values: PraiseFormValues): PostContent {
  return {
    kind: "PRAISE",
    youtubeUrl: values.youtubeUrl.trim(),
    sections: toContentSections(values),
    meditationAndPrayer: toTiptapDoc(values.meditationAndPrayer),
  };
}

/** 저장된 content를 폼 값으로 되돌린다 (이어쓰기 진입) */
export function fromDraftContent(
  content: DraftContent | null,
  title: string,
  tags: string[] = [],
): PraiseFormValues {
  if (content?.kind !== "PRAISE") return { ...emptyPraiseForm(), title, tags };

  const sections = (content.sections ?? []).map((section, index) => ({
    // 저장된 id가 없으면 자리 번호로 채운다 — 재정렬 키가 없으면 드래그가 엉킨다
    id: section.id ?? sectionIdAt(index),
    label: fromContentLabel(section.label),
    lyrics: section.lyrics ?? "",
  }));

  return {
    title,
    youtubeUrl: content.youtubeUrl ?? "",
    sections:
      sections.length > 0
        ? sections
        : [{ id: sectionIdAt(0), label: DEFAULT_SECTION_LABEL, lyrics: "" }],
    meditationAndPrayer: (content.meditationAndPrayer ?? EMPTY_TIPTAP_DOC) as RichTextValue,
    tags,
  };
}
