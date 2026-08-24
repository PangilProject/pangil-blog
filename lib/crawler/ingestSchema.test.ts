import { describe, expect, it } from "vitest";

import { CrawlIngestSchema } from "@/lib/crawler/ingestSchema";

/**
 * 신뢰 경계(06 §3). Actions는 배포와 무관하게 어제 코드로 계속 돌 수 있으므로,
 * 형식이 어긋난 보고를 서버가 받아 저장하는 일이 없어야 한다.
 */

const parsed = {
  title: "내 의와 성취가 아닌",
  scriptureRef: "열왕기상 5:1~6",
  scriptureBody: "1 솔로몬이…",
  annotations: [{ term: "백향목", body: "고급 목재" }],
  questionGroups: [{ group: "내용관찰", questions: [{ label: "1", text: "누구입니까?" }] }],
};

describe("CrawlIngestSchema", () => {
  it("SUCCESS 보고를 받는다", () => {
    expect(
      CrawlIngestSchema.safeParse({ outcome: "SUCCESS", runDate: "2026-08-24", parsed }).success,
    ).toBe(true);
  });

  it("runDate가 KST YYYY-MM-DD가 아니면 거부한다", () => {
    expect(
      CrawlIngestSchema.safeParse({ outcome: "SUCCESS", runDate: "2026/08/24", parsed }).success,
    ).toBe(false);
    expect(
      CrawlIngestSchema.safeParse({
        outcome: "SUCCESS",
        runDate: "2026-08-24T00:00:00Z",
        parsed,
      }).success,
    ).toBe(false);
  });

  it("답변을 실어 보내면 그 필드는 버린다 — 크롤러는 묵상을 만들지 않는다", () => {
    const result = CrawlIngestSchema.safeParse({
      outcome: "SUCCESS",
      runDate: "2026-08-24",
      parsed: {
        ...parsed,
        questionGroups: [
          {
            group: "내용관찰",
            questions: [{ label: "1", text: "누구입니까?", answer: { type: "doc", content: [1] } }],
          },
        ],
      },
    });

    expect(result.success).toBe(true);
    if (!result.success || result.data.outcome !== "SUCCESS") return;
    expect(result.data.parsed.questionGroups[0].questions[0]).toEqual({
      label: "1",
      text: "누구입니까?",
    });
  });

  it("모르는 stage는 거부한다", () => {
    expect(
      CrawlIngestSchema.safeParse({ outcome: "FAILED", runDate: "2026-08-24", stage: "unknown" })
        .success,
    ).toBe(false);
  });

  it("SKIPPED는 근거를 반드시 적어야 한다 — '빈 것처럼 보임'은 근거가 아니다(06 §2)", () => {
    expect(CrawlIngestSchema.safeParse({ outcome: "SKIPPED", runDate: "2026-08-24" }).success).toBe(
      false,
    );
    expect(
      CrawlIngestSchema.safeParse({ outcome: "SKIPPED", runDate: "2026-08-24", reason: "" })
        .success,
    ).toBe(false);
    expect(
      CrawlIngestSchema.safeParse({
        outcome: "SKIPPED",
        runDate: "2026-08-23",
        reason: "no-content(주일은 오늘의큐티가 없습니다)",
      }).success,
    ).toBe(true);
  });

  it("모르는 outcome은 거부한다", () => {
    expect(CrawlIngestSchema.safeParse({ outcome: "PARTIAL", runDate: "2026-08-24" }).success).toBe(
      false,
    );
  });
});
