import Link from "next/link";

import { signOut } from "@/lib/actions/auth";

/**
 * 관리 화면 상단 (02 §2.4 관리 네비 · 프로토타입 A-01 헤더).
 * 대시보드·초안함·글 관리·통계·블로그 관리가 서로를 가리킨다 — 관리 화면에서 길을 잃지 않을 최소치다.
 */
export function AdminNav() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-edge border-b bg-paper px-[5%] py-[13px]">
      <Link href="/admin" className="font-serif text-[15px]">
        기록 <em className="font-typewriter text-[11px] text-faint not-italic">관리</em>
      </Link>

      <nav className="flex items-center gap-4 font-typewriter text-[11.5px] text-faint">
        <Link href="/admin/drafts" className="hover:text-ink">
          초안함
        </Link>
        <Link href="/admin/posts" className="hover:text-ink">
          글 관리
        </Link>
        <Link href="/admin/stats" className="hover:text-ink">
          통계
        </Link>
        <Link href="/admin/settings" className="hover:text-ink">
          블로그 관리
        </Link>
        {/* 언제든 떠날 수 있다는 사실을 화면에 둔다(07 §3) */}
        <a href="/admin/export" className="hover:text-ink">
          내보내기
        </a>
        <form action={signOut}>
          <button type="submit" className="hover:text-ink">
            로그아웃
          </button>
        </form>
      </nav>
    </header>
  );
}
