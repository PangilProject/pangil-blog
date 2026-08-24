import "server-only";

import type { PostContent } from "@/lib/content/schema";
import { shouldKeepPost } from "@/lib/crawler/userEdited";
import { prisma } from "@/lib/db/prisma";
import { kstDateKeyAsUtcMidnight } from "@/lib/record/kst";
import { CrawlStatus, PostStatus, PostType } from "@/prisma/generated/enums";

/**
 * crawl_runs 리포지토리 (05 §1.4 · 06 §3).
 *
 * `runDate`가 유니크라 upsert 하나로 멱등이 된다 — 수동 재실행(`workflow_dispatch`)이나
 * 중복 트리거가 초안을 두 개 만들지 않는다.
 *
 * 이 파일에는 **발행 경로가 없다.** 크롤러 토큰으로 도달할 수 있는 코드가 DRAFT만 만든다는
 * 것을 권한이 아니라 코드로 보장한다(06 §1.1 · 04 §4).
 */

export type CrawlRunSummary = {
  status: CrawlStatus;
  postId: string | null;
  errorMessage: string | null;
};

export async function findCrawlRun(runDateKey: string): Promise<CrawlRunSummary | null> {
  return prisma.crawlRun.findUnique({
    where: { runDate: kstDateKeyAsUtcMidnight(runDateKey) },
    select: { status: true, postId: true, errorMessage: true },
  });
}

export async function recordCrawlFailure({
  runDateKey,
  message,
}: {
  runDateKey: string;
  message: string;
}) {
  const runDate = kstDateKeyAsUtcMidnight(runDateKey);
  const finishedAt = new Date();

  // 이미 만들어진 초안이 있어도 postId는 건드리지 않는다 — 오늘 실패가 어제 성공의
  // 결과물을 지울 이유는 없고, 대시보드는 초안이 있으면 그걸 먼저 보여준다(02 §3.1)
  await prisma.crawlRun.upsert({
    where: { runDate },
    create: { runDate, status: CrawlStatus.FAILED, errorMessage: message, finishedAt },
    update: { status: CrawlStatus.FAILED, errorMessage: message, finishedAt },
  });
}

export async function recordCrawlSkip({
  runDateKey,
  reason,
}: {
  runDateKey: string;
  reason: string;
}) {
  const runDate = kstDateKeyAsUtcMidnight(runDateKey);
  const finishedAt = new Date();

  await prisma.crawlRun.upsert({
    where: { runDate },
    create: { runDate, status: CrawlStatus.SKIPPED, errorMessage: reason, finishedAt },
    update: { status: CrawlStatus.SKIPPED, errorMessage: reason, finishedAt },
  });
}

export type CrawlSuccessAction = "created" | "replaced" | "kept";

export type CrawlSuccessResult = {
  action: CrawlSuccessAction;
  postId: string;
};

/**
 * 성공 기록 + 초안 생성/갱신을 한 트랜잭션에.
 *
 * `kept`는 사람이 이미 손댄 초안이라 덮지 않은 경우다. 이 분기가 이 함수의 존재 이유다.
 */
export async function recordCrawlSuccess({
  runDateKey,
  title,
  content,
  questionCount,
  annotationCount,
}: {
  runDateKey: string;
  title: string;
  content: PostContent;
  questionCount: number;
  annotationCount: number;
}): Promise<CrawlSuccessResult> {
  const runDate = kstDateKeyAsUtcMidnight(runDateKey);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.crawlRun.findUnique({
      where: { runDate },
      select: { postId: true },
    });

    const draft = existing?.postId
      ? await tx.post.findUnique({
          where: { id: existing.postId },
          select: { id: true, status: true, content: true },
        })
      : null;

    const finishedAt = new Date();
    const counts = { questionCount, annotationCount };

    if (draft) {
      if (shouldKeepPost(draft)) {
        await tx.crawlRun.update({
          where: { runDate },
          data: { status: CrawlStatus.SUCCESS, errorMessage: null, finishedAt, ...counts },
        });
        return { action: "kept", postId: draft.id };
      }

      await tx.post.update({ where: { id: draft.id }, data: { title, content } });
      await tx.crawlRun.update({
        where: { runDate },
        data: { status: CrawlStatus.SUCCESS, errorMessage: null, finishedAt, ...counts },
      });
      return { action: "replaced", postId: draft.id };
    }

    const created = await tx.post.create({
      data: { type: PostType.QT, status: PostStatus.DRAFT, title, content },
      select: { id: true },
    });

    await tx.crawlRun.upsert({
      where: { runDate },
      create: {
        runDate,
        status: CrawlStatus.SUCCESS,
        postId: created.id,
        finishedAt,
        ...counts,
      },
      update: {
        status: CrawlStatus.SUCCESS,
        postId: created.id,
        errorMessage: null,
        finishedAt,
        ...counts,
      },
    });

    return { action: "created", postId: created.id };
  });
}
