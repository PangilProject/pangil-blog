import Link from "next/link";
import { Suspense } from "react";

import { Copyright } from "@/components/public/SiteFooter";
import { blogBrandName } from "@/lib/site/brand";
import { profileFromEnv } from "@/lib/site/profile";
import { siteHref } from "@/lib/site/publicUrl";

/**
 * 관리 화면 푸터 (2026-10-07).
 *
 * 공개 푸터(SiteFooter)를 그대로 쓰지 않는다. 그쪽은 읽는 사람이 글에서 나가는 길이라 구독·
 * 외부 링크·이용 부탁이 있는데, 관리 화면에서 필요한 것은 **내가 고친 지면을 보러 가는 길**뿐이다.
 * 그래서 세 지면 · 개인정보처리방침 · 저작권 한 줄만 둔다.
 *
 * 링크는 `from` 없이 만든다 — 관리 화면에서는 공개 지면이 늘 남의 호스트라 절대 주소다(siteHref).
 *
 * `AdminNav`를 쓰는 화면(대시보드·초안함·글 관리·통계·설정)의 맨 끝과 에디터 아래(app/admin/write/layout)에
 * 선다. 에디터는 원고지 아래라 쓰는 동안에는 보이지 않는다.
 */
export function AdminFooter() {
  const { name } = profileFromEnv();

  return (
    // 폰에서는 링크 줄과 저작권 줄로 나눈다 — 한 줄에 두면 저작권이 넘어가 혼자 오른쪽 끝에 떴다
    <footer className="mt-auto flex flex-col gap-2 border-edge border-t px-[5%] py-6 font-typewriter text-[11px] text-faint md:flex-row md:items-center md:gap-4">
      <nav
        aria-label="공개 지면"
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 *:whitespace-nowrap"
      >
        <Link href={siteHref("faith", "/faith")} className="hover:text-ink">
          {blogBrandName("faith")}
        </Link>
        <Link href={siteHref("dev", "/dev")} className="hover:text-ink">
          {blogBrandName("dev")}
        </Link>
        <Link href={siteHref("hub", "/hub")} className="hover:text-ink">
          소개
        </Link>
        <Link href={siteHref("hub", "/hub/privacy")} className="hover:text-ink">
          개인정보처리방침
        </Link>
      </nav>

      <p className="text-[10.5px] md:ml-auto">
        <Suspense fallback={<span className="opacity-0">© 0000</span>}>
          <Copyright name={name} />
        </Suspense>
      </p>
    </footer>
  );
}
