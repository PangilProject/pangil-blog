import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/AdminNav";
import { DraftList } from "@/components/admin/DraftList";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { getAdminUser } from "@/lib/auth/adminSession";
import { listDrafts } from "@/lib/db/posts";
import { formatRelativeTime } from "@/lib/record/relativeTime";

/**
 * A-02 초안함 (02 §2.4) — "이어쓰기 복귀".
 *
 * 이어쓰기 진입점은 둘이다: A-01 카드(오늘 글)와 여기(그 외) — 02 §3.2. 그래서 이 화면은
 * 최근 수정 순 목록 하나면 끝이다. 필터도 검색도 두지 않는다(초안이 수십 개가 될 리 없다).
 * 다만 쌓인 것을 치울 길은 둔다 — 골라서 한 번에 지운다(DraftList, 2026-10-05).
 */
/**
 * 세션을 읽는다(`getAdminUser`의 `connection()`) — 요청이 있어야 무엇을 그릴지 정해진다.
 * 레이아웃의 Suspense가 있어도 Next 16.3은 이 지면을 "즉시 전환 불가"로 개발 로그에 띄운다
 * (2026-10-05 확인). searchParams를 읽는 관리 페이지들과 같은 선언으로 맞춘다.
 */
export const instant = false;

export default async function AdminDraftsPage() {
  const user = await getAdminUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);

  const drafts = await listDrafts();
  const now = new Date();

  return (
    <div className="flex min-h-full flex-col bg-paper">
      <AdminNav />

      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-[5%] py-8">
        <h1 className="font-serif text-lg">초안함</h1>

        {drafts.length === 0 ? (
          <p className="text-sm text-ink-soft">이어서 쓸 초안이 없어요.</p>
        ) : (
          <DraftList
            drafts={drafts.map((draft) => ({
              id: draft.id,
              type: draft.type,
              title: draft.title,
              updatedLabel: formatRelativeTime(draft.updatedAt, now),
            }))}
          />
        )}
      </main>
    </div>
  );
}
