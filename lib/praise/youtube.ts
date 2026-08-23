/**
 * YouTube URL 파싱 (02 §5.4 "붙여넣기 즉시 임베드 프리뷰").
 *
 * 붙여넣은 URL을 iframe src에 그대로 넣지 않는다. 영상 id만 뽑아 우리가 아는 임베드 주소를
 * 만든다 — 남이 준 문자열을 프레임 주소로 쓰는 건 관리 화면에서도 하지 않을 일이다.
 *
 * id는 11자 [A-Za-z0-9_-]다. 이 규칙 밖이면 null을 주고, 화면은 프리뷰 없이 URL만 남긴다.
 */

const VIDEO_ID_PATTERN = /^[\w-]{11}$/;

const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

/** 경로에 id가 실리는 형태들 */
const PATH_PREFIXES = ["/embed/", "/shorts/", "/live/", "/v/"];

export function parseYouTubeId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!HOSTS.has(url.hostname)) return null;

  // youtu.be/ID
  if (url.hostname.endsWith("youtu.be")) {
    return check(url.pathname.slice(1));
  }

  if (url.pathname === "/watch") {
    return check(url.searchParams.get("v") ?? "");
  }

  for (const prefix of PATH_PREFIXES) {
    if (url.pathname.startsWith(prefix)) {
      return check(url.pathname.slice(prefix.length));
    }
  }

  return null;
}

function check(candidate: string): string | null {
  // 뒤에 붙은 경로·쿼리는 버린다 ("/embed/ID/extra")
  const id = candidate.split("/")[0] ?? "";
  return VIDEO_ID_PATTERN.test(id) ? id : null;
}

/** 우리가 만드는 임베드 주소. 추적을 줄이는 nocookie 도메인을 쓴다 */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

/** oEmbed 조회에 쓰는 정규 주소 */
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
