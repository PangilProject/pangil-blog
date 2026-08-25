/**
 * IndexNow 키 파일 (06 §8).
 *
 * 규격은 "이 키를 아는 사람이 이 사이트의 주인이다"를 이 파일 하나로 증명한다 — 검색엔진이
 * 제출을 받으면 여기를 읽어 키가 같은지 본다. 그래서 **이 값은 비밀이 아니다.** 공개되도록
 * 설계된 값이고, 유출로 할 수 있는 최대치는 "내 글을 색인해 달라고 재촉하는 것"이다.
 *
 * env에서 읽어 내려준다. 파일로 커밋하면 제출에 쓰는 값과 지면에 놓인 값이 갈라질 수 있고,
 * 그 불일치는 403으로만 드러난다(describeIndexNowStatus).
 *
 * 경로가 `/{key}.txt`가 아닌 이유는 lib/seo/indexNow의 INDEXNOW_KEY_PATH 주석에 있다.
 * 그 상수와 이 라우트의 경로가 어긋나면 403으로만 드러나므로 테스트로 묶어 둔다
 * (lib/seo/indexNow.test.ts).
 */
export async function GET() {
  const key = process.env.INDEXNOW_KEY;

  // 키가 없으면 파일도 없어야 한다. 빈 파일을 200으로 주면 검색엔진이 "키 불일치"가 아니라
  // "빈 키가 맞다"로 읽을 여지를 준다
  if (!key) return new Response(null, { status: 404 });

  return new Response(key, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // 키는 거의 바뀌지 않지만, 바꿨을 때 하루를 기다리면 안 된다
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
