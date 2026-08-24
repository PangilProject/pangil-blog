import { readFileSync } from "node:fs";

import type { CRAWL_STAGES, CrawlIngestBody } from "@/lib/crawler/ingestSchema";
import { countQtQuestions, type ParsedQt, validateParsedQt } from "@/lib/crawler/qtContent";
import { kstDateKey } from "@/lib/record/kst";
import { ParseError, parseTodayQt } from "@/scripts/crawler/parse.mts";
import { IngestError, report, withRetry } from "@/scripts/crawler/report.mts";
import { login, NetworkError } from "@/scripts/crawler/session.mts";

/**
 * QT 크롤러 실행부 (06 §2 의사코드).
 *
 *   npm run crawl -- --dry-run                 로그인·파싱·검증만. ingest POST 없음
 *   npm run crawl -- --date=2026-08-24         다른 날짜로(수동 재실행·확인용)
 *   npm run crawl -- --dry-run --fixture=파일  저장된 HTML로. 자격증명 없이 파이프라인 확인
 *
 * 종료 코드가 계약이다. 0 = 보고까지 끝냄(SUCCESS·SKIPPED), 1 = 실패. Actions는 이걸로
 * 붉게 물들고, 보고조차 못 한 경우는 watchdog가 잡는다(06 §5).
 *
 * **실패를 삼키지 않는다.** "본문이 비어 보임"은 SKIP 근거가 아니고(06 §2), 아무것도
 * 못 만든 날은 반드시 시끄럽게 끝난다 — 조용한 크롤러가 프리모템 #1의 실제 모습이다.
 */

type Stage = (typeof CRAWL_STAGES)[number];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}이(가) 설정되지 않았습니다`);
  return value;
}

function summarize(parsed: ParsedQt): string {
  const groups = parsed.questionGroups
    .map((group) => `${group.group} ${group.questions.length}`)
    .join(" · ");

  return [
    `제목      ${parsed.title}`,
    `말씀      ${parsed.scriptureRef}`,
    `본문      ${parsed.scriptureBody.split("\n").length}절`,
    `주석      ${parsed.annotations.length}개`,
    `질문      ${countQtQuestions(parsed)}개 (${groups})`,
  ].join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dateArg = args.find((arg) => arg.startsWith("--date="))?.slice("--date=".length);
  // 저장된 HTML로 파싱·검증만 확인한다. 365qt에 접속하지 않으므로 자격증명이 필요 없다
  const fixturePath = args.find((arg) => arg.startsWith("--fixture="))?.slice("--fixture=".length);
  const runDate = dateArg ?? kstDateKey(new Date());

  const target = dryRun
    ? null
    : { baseUrl: requireEnv("INGEST_URL"), token: requireEnv("CRAWLER_INGEST_TOKEN") };

  const send = async (body: CrawlIngestBody) => {
    if (!target) {
      console.log(`[crawl] --dry-run — 보고를 건너뜁니다:\n${JSON.stringify(body, null, 2)}`);
      return;
    }
    await report(body, target);
  };

  const fail = async (stage: Stage, detail: string) => {
    console.error(`[crawl] FAILED · ${stage} · ${detail}`);
    // 보고 자체가 실패하면 그건 그것대로 던진다 — watchdog가 오늘을 잡는다
    await send({ outcome: "FAILED", runDate, stage, detail });
    process.exitCode = 1;
  };

  console.log(`[crawl] ${runDate}${dryRun ? " (dry-run)" : ""}`);

  let html: string;
  try {
    if (fixturePath) {
      html = readFileSync(fixturePath, "utf-8");
      console.log(`[crawl] 픽스처를 읽습니다: ${fixturePath}`);
    } else {
      const session = await withRetry(
        () => login(requireEnv("QT365_ID"), requireEnv("QT365_PW")),
        // 자격증명이 틀린 것은 재시도해도 같다(06 §4)
        { label: "365qt 로그인", retryIf: (error) => error instanceof NetworkError },
      );

      html = await withRetry(() => session.fetchTodayQt(), {
        label: "오늘의 큐티 페이지",
        retryIf: (error) => error instanceof NetworkError,
      });
    }
  } catch (error) {
    const stage: Stage = error instanceof NetworkError ? "fetch" : "login";
    await fail(stage, error instanceof Error ? error.message : String(error));
    return;
  }

  let parsed: ParsedQt;
  try {
    const result = parseTodayQt(html, runDate);

    if (result.kind === "no-content") {
      console.log(`[crawl] SKIPPED · ${result.reason}`);
      await send({ outcome: "SKIPPED", runDate, reason: result.reason });
      return;
    }

    parsed = result.parsed;
  } catch (error) {
    const detail = error instanceof ParseError ? error.message : `예상 못한 오류: ${error}`;
    await fail("parse", detail);
    return;
  }

  const issues = validateParsedQt(parsed);
  if (issues.length > 0) {
    console.error(summarize(parsed));
    await fail("validate", issues.join(" / "));
    return;
  }

  console.log(summarize(parsed));

  await send({ outcome: "SUCCESS", runDate, parsed });
  console.log("[crawl] SUCCESS");
}

try {
  await main();
} catch (error) {
  // 보고 실패·env 누락처럼 여기까지 올라온 것들. 조용히 0으로 끝내지 않는다
  console.error(
    error instanceof IngestError ? `[crawl] 보고 실패: ${error.message}` : "[crawl] 중단:",
    error instanceof IngestError ? "" : error,
  );
  process.exitCode = 1;
}
