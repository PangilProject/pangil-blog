import { getAdminUser } from "@/lib/auth/adminSession";
import { findPostsForExport } from "@/lib/db/publicPosts";
import { toMarkdownFile } from "@/lib/export/markdownFile";

/**
 * 마크다운 일괄 내보내기 (07 M3 · §3 lock-in 방어).
 *
 * 목적은 **언제든 이 블로그를 떠날 수 있다는 사실**이다. 티스토리를 떠나며 겪은 일을 되풀이하지
 * 않기 위해 MVP에 넣었다.
 *
 * 관리자 전용이다. 발행된 글은 어차피 공개지만, 전량을 한 번에 긁어가는 경로를 열어둘 이유는
 * 없다 — 그건 크롤링 편의를 남에게 제공하는 것이다.
 *
 * 압축하지 않는다. 파일 하나에 문서 경계를 남기는 편이 의존성 없이 가장 단순하고, 받는 쪽에서
 * 쪼개기도 쉽다. zip이 필요해지면 그때 붙인다.
 */
const SEPARATOR = "\n\n";

export async function GET() {
  const user = await getAdminUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const posts = await findPostsForExport();
  const files = posts.map(toMarkdownFile);

  const body = files
    .map((file) => `<!-- ===== ${file.name} ===== -->\n\n${file.text}`)
    .join(SEPARATOR);

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="record-export-${stamp}.md"`,
      "cache-control": "no-store",
    },
  });
}
