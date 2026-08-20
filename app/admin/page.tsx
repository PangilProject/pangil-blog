import { redirect } from "next/navigation";

import { signOut } from "@/lib/actions/auth";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { getAdminUser } from "@/lib/auth/adminSession";

// A-01 대시보드. 오늘의 작성 카드·크롤러 상태는 M2·M4에서 채운다.
export default async function AdminDashboardPage() {
  // middleware가 이미 막지만, 서버에서 한 번 더 확인한다(05 §3.2 이중 가드).
  const user = await getAdminUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);

  return (
    <main className="flex flex-col gap-4 p-8">
      <h1 className="text-lg">대시보드</h1>
      <p>{user.email}</p>
      <form action={signOut}>
        <button type="submit" className="border px-3 py-2">
          로그아웃
        </button>
      </form>
    </main>
  );
}
