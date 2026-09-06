import { nanoid } from "nanoid";
import { z } from "zod";

import type { DraftContent, PostContent } from "@/lib/content/schema";
import { PRAISE_SECTION_LABELS, praiseMeditationBlocks } from "@/lib/content/schema";
import {
  EMPTY_RICH_TEXT,
  isEmptyDoc,
  type RichTextValue,
  toTiptapDoc,
} from "@/lib/editor/richText";
import { parseYouTubeId } from "@/lib/praise/youtube";
import { defaultTagsFor, hasOwnTags } from "@/lib/record/defaultTags";

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

/**
 * "묵상과 기도"의 한 덩이. id는 섹션과 같은 이유로 있다 — 블록을 지웠을 때 남은 편집기가
 * 자리 번호로 묶여 있으면 엉뚱한 글을 들고 있게 된다(React key).
 */
export type PraiseMeditationBlockFormValue = {
  id: string;
  doc: RichTextValue;
};

export type PraiseFormValues = {
  title: string;
  youtubeUrl: string;
  sections: PraiseSectionFormValue[];
  /** "묵상과 기도" — 묵상과 기도를 끊어 쓰는 블록 목록이다(명칭 확정, 02 §5.4) */
  meditationBlocks: PraiseMeditationBlockFormValue[];
  /**
   * 태그는 content가 아니라 태그 테이블에 산다(05 §1.4). 지면은 글 타입에서 나오므로
   * faith 글의 태그는 faith 지면에 쌓인다 — 여기서 지면을 들고 다니지 않는다.
   */
  tags: string[];
};

/** 번호를 매기는 데 필요한 것만. 공개 지면은 폼 값이 아니라 저장값을 들고 온다 */
export type SectionNumbering = { label: string; lyrics: string };

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

/** 묵상 블록도 같은 규칙이다 — 저장값에는 id가 없고, 폼 안에서만 쓴다 */
export function meditationBlockIdAt(index: number): string {
  return `meditation-${index + 1}`;
}

export function newMeditationBlock(): PraiseMeditationBlockFormValue {
  return { id: nanoid(), doc: EMPTY_RICH_TEXT };
}

/**
 * 빈 폼이 열어 두는 섹션 (02 §5.4).
 *
 * **Intro 다음 Verse**다. 곡은 거의 늘 전주로 시작하고, 그 다음 칸은 첫 절이다 — 처음 두 번은
 * 늘 같은 손놀림이었다(라벨을 Intro로 바꾸고, 섹션을 더하고, 라벨을 Verse로 되돌린다).
 * Intro는 마디 수만 받는 칸으로 열리므로(BAR_ONLY_LABELS) 가사 칸이 비어 남지 않는다.
 *
 * id는 자리 번호로 짓는다 — 서버 프리렌더에서는 난수를 쓸 수 없다(ADR-003).
 */
export function defaultSections(): PraiseSectionFormValue[] {
  return [
    { id: sectionIdAt(0), label: "Intro", lyrics: "" },
    { id: sectionIdAt(1), label: DEFAULT_SECTION_LABEL, lyrics: "" },
  ];
}

export function emptyPraiseForm(): PraiseFormValues {
  return {
    title: "",
    youtubeUrl: "",
    // 빈 화면을 주지 않는다. 첫 섹션은 늘 놓여 있다
    sections: defaultSections(),
    // 빈 화면을 주지 않는다. 첫 블록은 늘 놓여 있다 — 가사 섹션과 같다
    meditationBlocks: [{ id: meditationBlockIdAt(0), doc: EMPTY_RICH_TEXT }],
    tags: defaultTagsFor("PRAISE"),
  };
}

/**
 * Verse 번호 (04 §2.5 파생 계산 — 저장하지 않는다).
 *
 * 세는 것은 **자리가 아니라 서로 다른 절**이다. 같은 라벨에 가사까지 같은 섹션은 되풀이라서
 * 같은 번호를 받는다 — Verse 2를 한 번 더 부르는 곡에서 그 자리가 Verse 3이 되면 없는 절이
 * 생긴다. 악보도 되풀이에 새 번호를 붙이지 않는다.
 *
 * 가사가 빈 섹션은 서로 묶지 않는다. 타이핑 중에는 늘 빈 섹션이 하나 열려 있어서, 그것까지
 * 묶으면 새 Verse가 앞 절의 번호를 달고 있다가 한 글자 치는 순간 번호가 바뀐다.
 *
 * 번호는 서로 다른 절이 둘 이상일 때만 매긴다. Verse가 하나뿐인 곡에 "Verse 1"이라 적으면
 * 없는 Verse 2를 암시한다 — 되풀이만 있는 곡도 마찬가지다.
 */
export function sectionOrdinals(sections: SectionNumbering[]): (number | undefined)[] {
  const assigned = new Map<string, number>();
  const distinct = new Map<string, number>();

  const numbers = sections.map((section, index) => {
    const lyrics = section.lyrics.trim();
    // 빈 섹션은 제 자리 번호를 열쇠로 삼아 저희끼리도 묶이지 않는다
    const key = `${section.label}\u0000${lyrics === "" ? `@${index}` : lyrics}`;

    const already = assigned.get(key);
    if (already !== undefined) return already;

    const next = (distinct.get(section.label) ?? 0) + 1;
    distinct.set(section.label, next);
    assigned.set(key, next);
    return next;
  });

  return numbers.map((number, index) => {
    const label = sections[index]?.label ?? "";
    return (distinct.get(label) ?? 0) > 1 ? number : undefined;
  });
}

/** 한 섹션이 가져올 수 있는 다른 섹션 하나 */
export type LoadableSource = {
  /** 원본의 자리 번호. 화면에서 고른 값을 되찾는 열쇠다 */
  index: number;
  /** 화면에 적히는 이름 — 번호가 있으면 "Verse 2" */
  name: string;
  label: string;
  lyrics: string;
};

/**
 * `index` 자리에서 가져올 수 있는 섹션들 (02 §5.4).
 *
 * 후렴은 같은 가사가 여러 번 나오는데, 그때마다 다시 치는 것이 이 화면에서 제일 잦은
 * 반복이었다. 참조가 아니라 **복사**다 — 참조를 두면 원본이 바뀔 때 따라가는 규칙, 원본을
 * 지웠을 때의 규칙이 줄줄이 붙는데 저장 계약에는 그 참조를 둘 자리가 없다.
 *
 * 빼는 것 셋: 제 자신, 아직 빈 섹션, 연주 구간(마디 수만 있는 칸이라 가져올 가사가 없다).
 * 그리고 **이미 되풀이된 절은 한 번만 세운다** — 같은 이름·같은 가사가 두 줄로 서면 어느
 * 쪽을 골라야 하는지 묻는 꼴인데, 둘은 같은 것이다.
 */
export function loadableSources(sections: SectionNumbering[], index: number): LoadableSource[] {
  const ordinals = sectionOrdinals(sections);
  const seen = new Set<string>();

  return sections.flatMap((section, at) => {
    const lyrics = section.lyrics.trim();
    if (at === index || lyrics === "" || isBarOnlyLabel(section.label)) return [];

    const key = `${section.label}\u0000${lyrics}`;
    if (seen.has(key)) return [];
    seen.add(key);

    const ordinal = ordinals[at];
    return [
      {
        index: at,
        name: ordinal ? `${section.label} ${ordinal}` : section.label,
        label: section.label,
        lyrics: section.lyrics,
      },
    ];
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

/**
 * 묵상 블록 → 저장값. 빈 블록은 떨군다 — 엔터 두 번에 생긴 빈 칸이 지면에 빈 자리로
 * 나가면 안 된다. 하나도 남지 않으면 빈 배열이고, 그건 발행 게이트가 막는다.
 */
function toContentMeditation(values: PraiseFormValues) {
  return values.meditationBlocks
    .filter((block) => !isEmptyDoc(block.doc))
    .map((block) => toTiptapDoc(block.doc));
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
    meditationAndPrayer: toContentMeditation(values),
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
  meditationBlocks: z
    .array(z.object({ id: z.string(), doc: z.custom<RichTextValue>() }))
    .refine((blocks) => blocks.some((block) => !isEmptyDoc(block.doc)), "묵상과 기도를 적어주세요"),
});

export function toPublishContent(values: PraiseFormValues): PostContent {
  return {
    kind: "PRAISE",
    youtubeUrl: values.youtubeUrl.trim(),
    sections: toContentSections(values),
    meditationAndPrayer: toContentMeditation(values),
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

  const blocks = praiseMeditationBlocks(content.meditationAndPrayer).map((doc, index) => ({
    id: meditationBlockIdAt(index),
    doc: doc as RichTextValue,
  }));

  return {
    title,
    youtubeUrl: content.youtubeUrl ?? "",
    sections: sections.length > 0 ? sections : defaultSections(),
    // 문서 하나로 저장된 옛 글은 블록 하나로 열린다(praiseMeditationBlocks)
    meditationBlocks:
      blocks.length > 0 ? blocks : [{ id: meditationBlockIdAt(0), doc: EMPTY_RICH_TEXT }],
    tags,
  };
}

/**
 * 아직 아무것도 적지 않은 폼인가 (A-06 · 서식 전환 조건).
 *
 * 섹션은 빈 폼에도 하나가 놓여 있고(빈 화면을 주지 않는다) 라벨도 기본값이 들어 있다.
 * 그래서 **가사가 적혔는가**로 본다 — 라벨만 있는 섹션은 아직 빈 것이다.
 */
export function isEmptyForm(values: PraiseFormValues): boolean {
  return (
    values.title.trim() === "" &&
    values.youtubeUrl.trim() === "" &&
    values.sections.every((section) => section.lyrics.trim() === "") &&
    values.meditationBlocks.every((block) => isEmptyDoc(block.doc)) &&
    !hasOwnTags("PRAISE", values.tags)
  );
}
