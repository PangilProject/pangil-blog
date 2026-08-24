import { authorizeBearer } from "@/lib/crawler/auth";
import { CrawlIngestSchema } from "@/lib/crawler/ingestSchema";
import { buildQtContent, countQtQuestions, validateParsedQt } from "@/lib/crawler/qtContent";
import { recordCrawlFailure, recordCrawlSkip, recordCrawlSuccess } from "@/lib/db/crawlRuns";
import { notifySlack } from "@/lib/notify/slack";

/**
 * `POST /api/crawler/ingest` (06 §1.1 · §3).
 *
 * Actions는 크롤링만 하고 **기록과 알림은 여기서 한다**. 크롤러 자격증명은 Actions Secrets에,
 * Slack 웹훅은 Vercel env에 — 어느 한쪽이 털려도 다른 쪽을 얻지 못한다.
 *
 * 이 경로에서 도달 가능한 쓰기는 DRAFT 생성/갱신뿐이고 `updateTag`·`revalidate` 호출이 없다
 * (04 §4). 크롤러가 공개 캐시를 건드릴 수 없다는 것을 코드로 보장한다 —
 * **여기에 무효화 호출을 추가하지 마라.**
 */
export async function POST(request: Request) {
  if (!authorizeBearer(request, process.env.CRAWLER_INGEST_TOKEN)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }

  const parsedBody = CrawlIngestSchema.safeParse(raw);
  if (!parsedBody.success) {
    // 스키마를 못 맞춘 요청은 크롤러 쪽 버그다. 조용히 200을 주면 몇 주를 모른다
    const issues = parsedBody.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join(" / ");
    await notifySlack(`🔴 QT 크롤러 보고 형식 오류 · ${issues}`);
    return Response.json({ error: "invalid-body", issues }, { status: 400 });
  }

  const body = parsedBody.data;

  if (body.outcome === "FAILED") {
    const message = `${body.stage} · ${body.detail ?? "상세 없음"}`;
    await recordCrawlFailure({ runDateKey: body.runDate, message });
    await notifySlack(`🔴 QT 크롤러 실패 · ${body.runDate} · ${message}`);
    return Response.json({ ok: true });
  }

  if (body.outcome === "SKIPPED") {
    await recordCrawlSkip({ runDateKey: body.runDate, reason: body.reason });
    await notifySlack(`⚪ QT 미게시 · ${body.runDate} · ${body.reason}`, { quiet: true });
    return Response.json({ ok: true });
  }

  // 06 §3 "Actions 검증을 재검증". 위반은 400이 아니라 FAILED다 — 요청 형식이 아니라
  // 크롤 결과가 틀렸고, 그건 crawl_runs에 남아야 대시보드가 폴백 카드를 띄운다
  const issues = validateParsedQt(body.parsed);
  if (issues.length > 0) {
    const message = `validate · ${issues.join(" / ")}`;
    await recordCrawlFailure({ runDateKey: body.runDate, message });
    await notifySlack(`🔴 QT 크롤러 검증 실패 · ${body.runDate} · ${issues.join(" / ")}`);
    return Response.json({ error: "invalid-parse", issues }, { status: 422 });
  }

  const result = await recordCrawlSuccess({
    runDateKey: body.runDate,
    title: body.parsed.title.trim(),
    content: buildQtContent(body.parsed),
    questionCount: countQtQuestions(body.parsed),
    annotationCount: body.parsed.annotations.length,
  });

  const summary = `${body.parsed.scriptureRef} · 질문${countQtQuestions(body.parsed)}·주석${body.parsed.annotations.length}`;
  await notifySlack(
    result.action === "kept"
      ? `🟡 QT 초안 보존 · ${body.runDate} · 이미 작성 중인 초안이 있어 덮지 않았습니다`
      : `🟢 QT 초안 ${result.action === "created" ? "생성" : "갱신"} · ${body.runDate} · ${summary}`,
    { quiet: true },
  );

  return Response.json({ ok: true, action: result.action, postId: result.postId });
}
