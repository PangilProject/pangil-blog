import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/AdminNav";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { getAdminUser } from "@/lib/auth/adminSession";
import { listDrafts } from "@/lib/db/posts";
import { formatRelativeTime } from "@/lib/record/relativeTime";
import { editorPath, RECORD_TYPE_LABELS } from "@/lib/record/todayCard";

/**
 * A-02 초안함 (02 §2.4) — "이어쓰기 복귀".
 *
 * 이어쓰기 진입점은 둘이다: A-01 카드(오늘 글)와 여기(그 외) — 02 §3.2. 그래서 이 화면은
 * 최근 수정 순 목록 하나면 끝이다. 필터도 검색도 두지 않는다(초안이 수십 개가 될 리 없다).
 */
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
          <ul className="flex flex-col divide-y divide-edge border border-edge bg-card">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Link
                  href={editorPath(draft.type, draft.id)}
                  className="flex flex-wrap items-baseline gap-3 px-4 py-3 hover:bg-paper"
                >
                  <span className="w-[68px] font-typewriter text-[10.5px] text-faint">
                    {RECORD_TYPE_LABELS[draft.type]}
                  </span>
                  <span className="flex-1 text-[14px]">{draft.title || "제목 없음"}</span>
                  <span className="font-typewriter text-[10.5px] text-faint">
                    {formatRelativeTime(draft.updatedAt, now)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
