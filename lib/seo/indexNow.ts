/**
 * IndexNow 제출 (06 §8 · §10 미결 #5 해소).
 *
 * **왜 IndexNow 하나인가.** 구글은 2023년에 sitemap ping 엔드포인트를 폐지했고, Indexing API는
 * 채용공고·라이브스트림 전용이라 블로그 글에 쓸 수 없다 — 구글 쪽은 자동화할 것이 없고
 * 서치콘솔에 sitemap을 한 번 등록하는 것이 전부다. 네이버의 "수집 요청 API"는 신디케이션에서
 * 전환된 **제휴(승인) 경로**라 개인 블로그가 키를 받을 수 없다. 그런데 네이버는 2023년 7월부터
 * IndexNow를 지원한다 — 그래서 규격 하나로 네이버·Bing·Yandex가 함께 커버된다.
 *
 * 이 파일은 **네트워크를 모른다.** 요청을 만드는 것과 보내는 것을 갈라 두면 규격(호스트 일치,
 * 키 위치, URL 상한)을 테스트로 고정할 수 있다.
 */

/** 모든 참여 엔진에 한 번에 전달한다. 엔진별 엔드포인트를 나열하면 하나 죽을 때 전체가 흔들린다 */
const ENDPOINT = "https://api.indexnow.org/indexnow";

/**
 * 키 파일 경로. 규격의 관례는 `/{key}.txt`지만 그건 App Router에서 최상위 catch-all이 되어
 * 3면 라우팅과 충돌한다. 규격이 허용하는 `keyLocation`을 쓰고 고정 경로에 둔다 — 파일이
 * **루트 디렉터리**에 있으므로 사이트 전체 URL이 유효 범위다.
 */
export const INDEXNOW_KEY_PATH = "/indexnow.txt";

/** 규격 상한. 우리가 한 번에 이만큼 보낼 일은 없지만, 상한을 코드에 남겨 둔다 */
const MAX_URLS = 10_000;

export type IndexNowRequest = {
  endpoint: string;
  body: { host: string; key: string; keyLocation: string; urlList: string[] };
};

export type IndexNowPlan =
  | { submit: true; request: IndexNowRequest }
  | { submit: false; reason: "no-key" | "no-domain" | "no-urls" };

/**
 * 보낼지 말지, 보낸다면 무엇을 보낼지 결정한다.
 *
 * **도메인이 확정되기 전에는 보내지 않는다.** 지금 주소는 Vercel 기본 호스트인데, 그 주소로
 * 색인을 만들어 두면 실제 도메인으로 옮길 때 301을 걸 수 없다(00 §6.3이 지적한 그 문제를
 * 우리가 한 번 더 만드는 셈이다). SITE_HOST_*가 설정되는 순간부터 동작한다 — 그게 출시
 * 게이트(07 §4)의 일부다.
 */
export function planIndexNow({
  key,
  siteHost,
  urls,
}: {
  key: string | undefined;
  siteHost: string | undefined;
  urls: string[];
}): IndexNowPlan {
  // 도메인을 먼저 본다. 순서가 중요하다 — 도메인 미확정 구간에서 키가 없는 것은 설정 실수가
  // 아니라 예정된 상태이고, `no-key`로 보고되면 매 발행마다 경고가 남는다
  if (!siteHost) return { submit: false, reason: "no-domain" };
  if (!key) return { submit: false, reason: "no-key" };

  const urlList = [...new Set(urls.filter((url) => url.startsWith(`https://${siteHost}/`)))].slice(
    0,
    MAX_URLS,
  );
  if (urlList.length === 0) return { submit: false, reason: "no-urls" };

  return {
    submit: true,
    request: {
      endpoint: ENDPOINT,
      body: {
        host: siteHost,
        key,
        keyLocation: `https://${siteHost}${INDEXNOW_KEY_PATH}`,
        urlList,
      },
    },
  };
}

/** 규격의 응답 코드 (indexnow.org/documentation) */
export function describeIndexNowStatus(status: number): string {
  switch (status) {
    case 200:
      return "수락됨";
    case 202:
      return "수락됨(키 검증 대기)";
    case 400:
      return "형식 오류";
    case 403:
      return "키 불일치 — 키 파일이 지면에서 읽히는지 확인";
    case 422:
      return "URL이 호스트와 불일치";
    case 429:
      return "요청 과다";
    default:
      return `알 수 없는 응답 ${status}`;
  }
}
