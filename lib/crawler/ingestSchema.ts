import { z } from "zod";

/**
 * ingest 요청 스키마 (06 §3) — **신뢰 경계**.
 *
 * Actions는 이미 검증하고 보내지만 여기서 다시 본다. 토큰을 가진 쪽이 곧 옳은 것은 아니고
 * (토큰은 유출될 수 있다), 무엇보다 크롤러의 낡은 버전이 계속 돌 수 있다 —
 * Actions는 우리가 배포를 미뤄도 어제 코드로 아침마다 실행된다.
 *
 * 6질문·4그룹 규칙은 여기 적지 않는다. 그건 lib/crawler/qtContent의 validateParsedQt가
 * 파서와 공유하는 규칙이고, 위반은 400이 아니라 **FAILED 기록 + Slack**으로 다뤄야 한다.
 */

const RUN_DATE = /^\d{4}-\d{2}-\d{2}$/;

const runDate = z.string().regex(RUN_DATE, "runDate는 KST YYYY-MM-DD여야 합니다");

/** 어디서 죽었는지 — Slack 한 줄에 그대로 실린다 */
export const CRAWL_STAGES = ["login", "fetch", "parse", "validate"] as const;

const ParsedQtSchema = z.object({
  title: z.string(),
  scriptureRef: z.string(),
  scriptureBody: z.string(),
  annotations: z.array(
    z.object({
      term: z.string(),
      verseRef: z.string().optional(),
      body: z.string(),
    }),
  ),
  questionGroups: z.array(
    z.object({
      group: z.string(),
      // 답변 자리는 받지 않는다. 크롤러가 답을 보내는 일 자체가 없어야 한다(06 §0)
      questions: z.array(z.object({ label: z.string(), text: z.string() })),
    }),
  ),
});

export const CrawlIngestSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("SUCCESS"),
    runDate,
    parsed: ParsedQtSchema,
  }),
  z.object({
    outcome: z.literal("FAILED"),
    runDate,
    stage: z.enum(CRAWL_STAGES),
    detail: z.string().max(2000).optional(),
  }),
  z.object({
    outcome: z.literal("SKIPPED"),
    runDate,
    // "빈 것처럼 보임"은 SKIP 근거가 아니다(06 §2) — 근거를 반드시 적게 한다
    reason: z.string().min(1).max(200),
  }),
]);

export type CrawlIngestBody = z.infer<typeof CrawlIngestSchema>;
