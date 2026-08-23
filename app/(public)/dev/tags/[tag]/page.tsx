import { connection } from "next/server";

import { ListPageView } from "@/components/public/ListPageView";
import { countPublishedPosts, findPublishedPosts } from "@/lib/db/publicLists";
import { startOfKstMonth, toKstDate } from "@/lib/record/kst";

/**
 * 태그별 목록 (02 §2.2 D-03 · §2.3 F-04).
 *
 * 상세 지면의 태그에서 오는 링크이고 검색엔진이 읽는 주소이므로 쿼리가 아니라 경로다.
 * 마이그레이션으로 들어오는 티스토리 해시태그도 이 지면으로 모인다(05 §6).
 */
export const instant = false;

export default async function TagListPage({ params, searchParams }: PageProps<"/dev/tags/[tag]">) {
  // 시계를 읽기 전에 요청을 확보한다(ADR-003 — 프리렌더는 재현 가능한 출력만 허용한다)
  await connection();

  const [{ tag }, query] = await Promise.all([params, searchParams]);
  const name = decodeURIComponent(tag);
  const page = Number(typeof query.page === "string" ? query.page : 1) || 1;
  const now = new Date();

  const [list, counts] = await Promise.all([
    findPublishedPosts({ site: "dev", tag: name, page }),
    countPublishedPosts("dev", startOfKstMonth(now)),
  ]);

  return (
    <ListPageView
      title={`#${name}`}
      month={`${toKstDate(now).month}월`}
      counts={counts}
      page={list}
      hrefFor={(target) => (target > 1 ? `/dev/tags/${tag}?page=${target}` : `/dev/tags/${tag}`)}
      searchAction="/dev"
      emptyMessage="이 태그의 기록이 아직 없어요"
    />
  );
}
