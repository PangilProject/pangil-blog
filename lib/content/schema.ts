import { z } from "zod";

/**
 * content JSONB 스키마 (05 §2 · 04 §2.4) — 이 프로젝트의 진실의 스키마.
 *
 * posts는 단일 테이블 + content JSONB이고(ADR-002), 타입 안전성은 이 경계에서 회복된다.
 * 저장 전 / 발행 전 / 렌더링 전 3곳에서 같은 스키마를 통과시킨다.
 *
 * 스키마 2벌:
 * - PublishSchema: 구조 필수. publishPost만 이걸 통과시킨다(05 §3.4 발행 게이트).
 *   앱 코드가 만지는 타입이므로 필드가 필수임이 **정적 타입에도** 드러나야 한다
 * - DraftSchema:   kind만 필수, 나머지는 재귀적으로 optional. 자동 저장은 무엇이든 저장한다.
 *   PublishSchema에서 파생시킨다 — 두 벌을 손으로 적으면 한쪽만 고치는 드리프트가 생긴다
 *   (Zod v4에 deepPartial이 없어 직접 구현, 04 미결 #4 · 05 미결 #5 해소)
 */

/**
 * Tiptap 문서. 노드 내부는 검증하지 않는다 — 어떤 스키마로도 정규화 불가하고(ADR-002 근거 6),
 * 렌더러가 모르는 노드는 건너뛴다. 05 §2는 z.any()로 적었으나 z.json()이 더 안전하다.
 */
const TiptapDocSchema = z.object({
  type: z.literal("doc"),
  // z.json()은 "JSON으로 표현 가능한 값"이다. unknown으로 두면 Prisma의 Json 입력 타입과
  // 구조적으로 맞지 않아 경계마다 캐스팅이 필요해진다 — 캐스팅은 경계를 무력화한다.
  content: z.array(z.json()),
});

export type TiptapDoc = z.infer<typeof TiptapDocSchema>;

/** 빈 Tiptap 문서 — 크롤러가 만드는 초안의 답변·요약 자리(06 §2) */
export const EMPTY_TIPTAP_DOC: TiptapDoc = { type: "doc", content: [] };

/** 찬양 섹션 라벨 7종 (02 §5.4). enum 밖은 직접 입력으로 받는다 */
export const PRAISE_SECTION_LABELS = [
  "Intro",
  "Verse",
  "Pre-Chorus",
  "Chorus",
  "Bridge",
  "Interlude",
  "Outro",
] as const;

/** QT 질문 그룹 4종 (02 §5.2 · 06 §6 검증 규칙의 라벨 집합) */
export const QT_QUESTION_GROUPS = ["내용관찰", "연구와 묵상", "느낀 점", "결단과 적용"] as const;

/** QT 질문 수·그룹 수 (06 §6 — 어긋나면 크롤러는 FAILED로 시끄럽게 실패한다) */
export const QT_QUESTION_COUNT = 6;
export const QT_GROUP_COUNT = 4;

const QtAnnotationSchema = z.object({
  term: z.string(),
  verseRef: z.string().optional(),
  body: z.string(),
});

const QtQuestionSchema = z.object({
  label: z.string(), // "1", "5-1"
  text: z.string(), // 질문 원문 (편집 가능 — 크롤링 필드에 잠금 없음)
  answer: TiptapDocSchema, // 공란 허용. 발행 차단은 하지 않고 UI 경고만(02 §6)
});

const QtQuestionGroupSchema = z.object({
  group: z.string(),
  questions: z.array(QtQuestionSchema),
});

const QtContentSchema = z.object({
  kind: z.literal("QT"),
  scriptureRef: z.string(),
  scriptureBody: z.string(),
  // 주석 없는 날도 정상이므로 빈 배열을 허용한다(02 §5.2)
  annotations: z.array(QtAnnotationSchema),
  questionGroups: z.array(QtQuestionGroupSchema),
  summary: TiptapDocSchema,
});

const SermonContentSchema = z.object({
  kind: z.literal("SERMON"),
  /**
   * 그날 설교의 제목 (02 §5.3). posts.title은 **글 제목**이고 이것과 다르다 —
   * "2026년 08월 23일 주일 예배 설교"가 글 제목이고 "하나님의 편에 서라"가 설교 제목이다.
   *
   * **발행 스키마에서도 optional이다.** 이관해 온 글에는 이 값이 없고, 필수로 두면 그 글들이
   * 렌더링 전 검증에서 떨어져 원문 폴백으로 그려진다(04 §2.4). 화면 쪽 발행 게이트는 필수로
   * 받는다 — 새로 쓰는 글에는 빠지지 않게 하고, 옛 글은 읽히게 둔다.
   */
  sermonTitle: z.string().optional(),
  scriptureRef: z.string(),
  // 실제로 항상 포함되므로 발행 시 필수로 격상됐다(02 결정 로그 #13)
  scriptureBody: z.string(),
  body: TiptapDocSchema, // 라이브 속기
  summary: TiptapDocSchema.optional(), // 예배 후 선택
});

const PraiseSectionSchema = z.object({
  id: z.string(), // nanoid. 순서는 배열 인덱스가 유일한 진실(04 §2.5)
  label: z.union([z.enum(PRAISE_SECTION_LABELS), z.object({ custom: z.string() })]),
  lyrics: z.string().default(""), // 빈 섹션 허용 — 연주 메모만 있는 섹션이 있다
});

/**
 * 감춘 묵상 블록 (02 §5.4).
 *
 * 문서만 있는 옛 저장값에는 표시를 붙일 자리가 없어서 감출 때만 이 껍데기를 씌운다.
 * 보이는 블록은 예전처럼 문서 그대로 저장된다 — 안 감춘 블록까지 모양이 바뀌면
 * 이미 발행된 글 전부가 다음 저장에서 통째로 다시 쓰인다.
 */
const HiddenPraiseMeditationSchema = z.object({
  doc: TiptapDocSchema,
  hidden: z.boolean().optional(),
});

/**
 * "묵상과 기도" (02 §5.4).
 *
 * 블록 여러 개다 — 묵상 한 덩이, 기도 한 덩이처럼 끊어 쓰는 글이라 한 칸에 몰아 두면
 * 어디서 끊겼는지가 저장값에 남지 않는다. **읽기는 세 갈래고 쓰기는 늘 배열이다**:
 * 이미 발행된 글이 문서 하나로 저장돼 있고(가장 옛것), 그다음이 문서 배열, 감춘 블록만
 * `{ doc, hidden }`이다. 분기를 펴는 곳은 praiseMeditationBlocks 한 곳뿐이다 —
 * 읽는 쪽마다 풀면 규칙이 다섯 곳에 생긴다.
 */
const PraiseMeditationSchema = z.union([
  TiptapDocSchema,
  z.array(z.union([TiptapDocSchema, HiddenPraiseMeditationSchema])),
]);

export type PraiseMeditation = z.infer<typeof PraiseMeditationSchema>;

/** 편 뒤의 한 덩이. 여기서부터는 어느 저장 모양에서 왔는지 아무도 몰라도 된다 */
export type PraiseMeditationBlock = { doc: TiptapDoc; hidden: boolean };

/**
 * 저장값을 블록 배열로 편다. 옛 글(문서 하나)은 블록 하나짜리로 읽히고, 표시가 없는
 * 블록은 보이는 것으로 읽는다.
 */
export function praiseMeditationBlocks(
  value: PraiseMeditation | undefined | null,
): PraiseMeditationBlock[] {
  if (!value) return [];

  const blocks = Array.isArray(value) ? value : [value];
  return blocks.map((block) =>
    "doc" in block
      ? { doc: block.doc, hidden: block.hidden === true }
      : { doc: block, hidden: false },
  );
}

const PraiseContentSchema = z.object({
  kind: z.literal("PRAISE"),
  youtubeUrl: z.url(),
  sections: z.array(PraiseSectionSchema),
  meditationAndPrayer: PraiseMeditationSchema,
});

const TechContentSchema = z.object({
  kind: z.literal("TECH"),
  body: TiptapDocSchema,
});

/** 발행 게이트용 — 구조 필수 (05 §3.4) */
export const PublishSchema = z.discriminatedUnion("kind", [
  QtContentSchema,
  SermonContentSchema,
  PraiseContentSchema,
  TechContentSchema,
]);

/**
 * 재귀 partial — kind(discriminator)만 남기고 전부 optional로 만든다.
 *
 * 값의 형식 검증은 유지한다: 잘못된 URL은 초안에서도 거른다. 형식이 깨진 값을 저장해두면
 * 발행 시점에 터지고, 그때는 이미 사용자가 다 적어놓은 상태다.
 */
function deepPartial(schema: z.ZodType): z.ZodType {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const partialShape: Record<string, z.ZodType> = {};

    for (const [key, value] of Object.entries(shape)) {
      // discriminator는 필수로 남긴다 — content는 행 컨텍스트 없이도 자기 기술적이어야 한다
      partialShape[key] = value instanceof z.ZodLiteral ? value : deepPartial(value).optional();
    }

    return z.object(partialShape);
  }

  if (schema instanceof z.ZodArray) {
    return z.array(deepPartial(schema.element as z.ZodType));
  }

  if (schema instanceof z.ZodOptional) {
    return deepPartial(schema.unwrap() as z.ZodType).optional();
  }

  if (schema instanceof z.ZodDefault) {
    // 기본값은 초안에서 강제하지 않는다 — 사용자가 아직 안 적은 것과 구분해야 한다
    return deepPartial(schema.unwrap() as z.ZodType);
  }

  return schema;
}

/** 자동 저장용 — kind만 필수 (04 §2.2 "자동 저장은 무엇이든 저장") */
export const DraftSchema = z.discriminatedUnion("kind", [
  deepPartial(QtContentSchema) as typeof QtContentSchema,
  deepPartial(SermonContentSchema) as typeof SermonContentSchema,
  deepPartial(PraiseContentSchema) as typeof PraiseContentSchema,
  deepPartial(TechContentSchema) as typeof TechContentSchema,
]);

/** 발행 가능한 완성 content. 앱 코드는 이 타입만 만진다 */
export type PostContent = z.infer<typeof PublishSchema>;
export type PostContentKind = PostContent["kind"];

/** 자동 저장 단계의 미완성 content */
export type DraftContent = {
  [K in PostContentKind]: { kind: K } & Partial<Omit<Extract<PostContent, { kind: K }>, "kind">>;
}[PostContentKind];

/**
 * posts.type과 content.kind 일치 검증 (05 §2).
 * content가 행 컨텍스트 없이도 자기 기술적이어야 하지만, 둘이 어긋나면 렌더러가 엉뚱한
 * 뷰를 고른다. 저장 시 반드시 확인한다.
 */
export function matchesPostType(type: string, content: { kind: string }): boolean {
  return type === content.kind;
}
