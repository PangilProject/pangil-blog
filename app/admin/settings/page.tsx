import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/AdminNav";
import { CategoryCreateForm } from "@/components/admin/CategoryCreateForm";
import { CategoryRow } from "@/components/admin/CategoryRow";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { getAdminUser } from "@/lib/auth/adminSession";
import { listCategoriesForAdmin } from "@/lib/db/categories";

/**
 * A-08 블로그 관리 (02 §2.4).
 *
 * 지금은 카테고리 하나다. 프로필(허브 노출 정보)과 크롤러 실행 로그가 같은 화면에 들어올
 * 자리이므로 섹션으로 나눠 둔다 — 화면을 하나 더 만들지 않는다.
 *
 * 카테고리는 **기술 지면 전용**이다. 신앙 지면의 큐티·설교·찬양은 분류가 아니라 글의
 * 종류이고(lib/record/axis), 타입마다 에디터·저장 계약·청구기호 시퀀스가 갈리므로 여기서
 * 늘릴 수 없다. 그 사실을 화면에도 한 줄로 적는다 — 없는 기능을 찾게 두지 않는다.
 */
export default async function AdminSettingsPage() {
  const user = await getAdminUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);

  const categories = await listCategoriesForAdmin();

  return (
    <div className="flex min-h-full flex-col bg-paper">
      <AdminNav />

      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-[5%] py-8">
        <h1 className="font-serif text-lg">블로그 관리</h1>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-[15px]">카테고리</h2>
            <p className="font-typewriter text-[11px] text-faint">
              기술 지면의 분류예요. 묵상은 큐티·설교·찬양으로 나뉘어요
            </p>
          </div>

          {categories.length === 0 ? (
            <p className="text-sm text-ink-soft">아직 분류가 없어요.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-edge border border-edge bg-card">
              {categories.map((category, index) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  isFirst={index === 0}
                  isLast={index === categories.length - 1}
                />
              ))}
            </ul>
          )}

          <p className="font-typewriter text-[10.5px] text-faint">
            이름은 언제든 바꿔도 돼요. 주소는 공개 링크에 쓰여서 만든 뒤에는 바꿀 수 없어요
          </p>

          <div className="border-edge border-t pt-4">
            <CategoryCreateForm />
          </div>
        </section>
      </main>
    </div>
  );
}
