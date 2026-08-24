/**
 * 365qt 로그인·페치 (06 §2 · 미결 #1 해소).
 *
 * 로그인 페이지가 순수 폼 POST다 — 캡차도, JS 게이트도 없다. 그래서 헤드리스 브라우저를
 * 쓰지 않는다: Playwright는 Actions 실행 시간을 분 단위로 늘리고, 브라우저 업데이트가
 * 크롤러를 깨뜨리는 새로운 실패 모드를 하나 더 만든다(프리모템 #6).
 *
 * ASP.NET antiforgery 규약: 로그인 페이지가 쿠키 하나와 폼의 숨은 토큰 하나를 함께 준다.
 * **둘을 같이 보내야** 통과한다.
 *
 * 자격증명은 Actions Secrets에서만 온다. 이 파일은 값을 로그에 절대 찍지 않는다.
 */

const BASE_URL = "https://www.365qt.com";
const LOGIN_PATH = "/User/Login?ReturnUrl=%2FQT%2FTodayQT";
const TODAY_QT_PATH = "/QT/TodayQT";

/** 사람이 쓰는 브라우저로 보이게 한다. 서버가 UA로 응답을 바꾸는 경우가 흔하다 */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

const TIMEOUT_MS = 20_000;

/** 자격증명이 틀렸다 — 재시도해도 같다(06 §4) */
export class AuthError extends Error {
  readonly name = "AuthError";
}

/** 일시적 실패 — 재시도 대상 */
export class NetworkError extends Error {
  readonly name = "NetworkError";
}

/**
 * 쿠키는 이름=값만 들고 다닌다. 한 호스트만 상대하고 세션도 한 번뿐이라
 * path·domain·expires를 지킬 필요가 없다 — 지키는 코드가 더 큰 위험이다.
 */
class CookieJar {
  private readonly cookies = new Map<string, string>();

  absorb(response: Response) {
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(";");
      const index = pair.indexOf("=");
      if (index <= 0) continue;
      this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }

  header(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

export type Session = {
  /** 로그인한 상태로 오늘의 큐티 HTML을 가져온다 */
  fetchTodayQt: () => Promise<string>;
};

async function request(
  url: string,
  jar: CookieJar,
  init: RequestInit & { referer?: string } = {},
): Promise<Response> {
  const { referer, ...rest } = init;

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": USER_AGENT,
        "accept-language": "ko-KR,ko;q=0.9",
        ...(jar.header() ? { cookie: jar.header() } : {}),
        ...(referer ? { referer } : {}),
        ...rest.headers,
      },
    });
  } catch (error) {
    throw new NetworkError(`${url} 요청 실패: ${error instanceof Error ? error.message : error}`);
  }

  jar.absorb(response);

  if (response.status >= 500) {
    throw new NetworkError(`${url} 응답 ${response.status}`);
  }

  return response;
}

function antiforgeryToken(html: string): string {
  const match = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
  if (!match) {
    // 로그인 페이지 구조가 바뀐 것이다. 자격증명 문제와 구분해서 알려야 고칠 곳을 안다
    throw new AuthError("로그인 폼에서 antiforgery 토큰을 찾지 못했습니다");
  }
  return match[1];
}

/** 로그인 폼이 다시 그려진 응답인가 — 자격증명 실패의 실제 모습이다 */
function looksLikeLoginForm(body: string): boolean {
  return (
    body.includes('name="__RequestVerificationToken"') && body.includes("아이디를 입력해주세요")
  );
}

function redirectsToLogin(location: string | null): boolean {
  return location?.includes("/User/Login") ?? false;
}

export async function login(id: string, password: string): Promise<Session> {
  const jar = new CookieJar();

  const loginPage = await request(`${BASE_URL}${LOGIN_PATH}`, jar);
  const token = antiforgeryToken(await loginPage.text());

  const form = new URLSearchParams({
    USER_ID: id,
    Password: password,
    __RequestVerificationToken: token,
  });

  const posted = await request(`${BASE_URL}/User/Login?returnurl=%2FQT%2FTodayQT`, jar, {
    method: "POST",
    body: form,
    referer: `${BASE_URL}${LOGIN_PATH}`,
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });

  // 성공하면 리다이렉트, 실패하면 로그인 폼을 다시 그려서 200으로 돌아온다
  if (posted.status !== 302 && posted.status !== 303) {
    const body = await posted.text();
    throw new AuthError(
      looksLikeLoginForm(body)
        ? "로그인 실패 — 아이디·비밀번호를 확인해주세요"
        : `로그인 응답이 예상과 다릅니다 (${posted.status})`,
    );
  }

  if (redirectsToLogin(posted.headers.get("location"))) {
    throw new AuthError("로그인 실패 — 로그인 페이지로 되돌아왔습니다");
  }

  return {
    async fetchTodayQt() {
      const response = await request(`${BASE_URL}${TODAY_QT_PATH}`, jar, {
        referer: `${BASE_URL}${LOGIN_PATH}`,
      });

      if (redirectsToLogin(response.headers.get("location"))) {
        // 세션이 안 붙었다. 파싱 실패로 보고하면 엉뚱한 곳을 고치게 된다
        throw new AuthError("오늘의 큐티가 로그인 페이지로 리다이렉트했습니다 (세션 미유지)");
      }

      if (!response.ok) {
        throw new NetworkError(`오늘의 큐티 응답 ${response.status}`);
      }

      return response.text();
    },
  };
}
