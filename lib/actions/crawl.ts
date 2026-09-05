"use server";

import { withAdmin } from "@/lib/actions/withAdmin";

/**
 * 손으로 QT 크롤 한 번 더 (A-01 · 06 §1.1).
 *
 * **여기서 크롤하지 않는다.** 이 액션이 하는 일은 Actions 워크플로우를 깨우는 것뿐이다.
 * 365qt 로그인·파싱은 `scripts/crawler`에 있고 그 자격증명은 Actions Secrets에만 있다
 * (06 §1.1 — 러너와 서버가 서로의 열쇠를 갖지 않는다). 앱에 같은 크롤을 한 벌 더 만들면
 * 새벽에 도는 것과 손으로 누르는 것이 서로 다른 코드가 되고, 그중 하나만 낡는다.
 *
 * 결과도 여기로 돌아오지 않는다. 워크플로우가 끝나면 평소처럼 `/api/crawler/ingest`로
 * 보고하고, 대시보드는 그 기록을 읽는다 — 손으로 부른 크롤과 새벽 크롤이 같은 길로 끝난다.
 *
 * 토큰은 env 이름만 코드에 둔다. 값은 Vercel에 넣는다(08 §3).
 */

/** 이 레포. 공개 정보이고 워크플로우 주소의 일부라 env로 뺄 이유가 없다 */
const REPO = "PangilProject/pangil-blog";
const WORKFLOW = "crawl-qt.yml";
/** 워크플로우는 기본 가지의 것으로 돈다 — 기능 가지의 크롤러로 실 데이터를 만들지 않는다 */
const REF = "main";

export type CrawlRequestResult = { ok: true } | { ok: false; reason: string };

export const requestQtCrawl = withAdmin(async (): Promise<CrawlRequestResult> => {
  const token = process.env.GITHUB_DISPATCH_TOKEN;

  // 토큰이 없는 것은 고장이 아니라 아직 안 켠 것이다. 로컬에는 값이 없는 게 정상이다
  if (!token) return { ok: false, reason: "가져오기를 아직 켜 두지 않았어요" };

  let response: Response;
  try {
    response = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
          "content-type": "application/json",
        },
        // 날짜를 비우면 오늘이다(워크플로우 입력 규약)
        body: JSON.stringify({ ref: REF, inputs: {} }),
      },
    );
  } catch {
    return { ok: false, reason: "가져오기를 부르지 못했어요" };
  }

  // 사유를 갈라 쓴다 — 권한이 없는 것과 주소가 틀린 것은 다음에 할 일이 다르다(03 §7.3b)
  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: "가져올 권한이 없어요" };
  }
  if (response.status === 404) {
    return { ok: false, reason: "가져오기 설정을 찾지 못했어요" };
  }
  if (!response.ok) {
    return { ok: false, reason: "가져오지 못했어요" };
  }

  return { ok: true };
});
