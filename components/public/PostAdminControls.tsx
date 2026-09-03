"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DeletePostButton } from "@/components/admin/DeletePostButton";
import { hasAdminUiHint } from "@/lib/auth/adminUiHint";

/**
 * 공개 상세의 관리 컨트롤 — `수정`·`지우기` (A-03b).
 *
 * **읽는 사람의 HTML에는 아무것도 없다.** 힌트 쿠키를 마운트 뒤에 읽고 그때 그린다. 그래서
 * 프리렌더된 지면에는 이 버튼들이 존재하지 않고, 지면 캐시도 그대로다(04 §1.2) — 서버에서
 * 세션을 보면 Supabase Auth에 왕복해야 하고, 그건 749편 모든 요청에 붙는 비용이다.
 *
 * 쿠키는 **보여줄지만** 정한다. 흉내 내면 버튼이 보이지만, 수정은 `/admin/edit/{slug}`가
 * 세션을 확인하고 삭제는 Server Action의 `withAdmin`이 막는다(05 §3.2).
 *
 * 04 §3.6의 공개 아일랜드 한도에 이것이 다섯 번째로 더해진다. 그리는 것이 있으므로 계측
 * 비콘처럼 예외로 두지 않고 정직하게 센다 — 대신 하는 일은 "쿠키를 읽고 링크 둘을 그린다"에서
 * 끝난다. 여기에 상태·설정·미리보기를 얹지 않는다.
 */
export function PostAdminControls({
  slug,
  postId,
  title,
  listPath,
}: {
  slug: string;
  postId: string;
  title: string;
  /** 지운 뒤 갈 곳 — 그 지면의 목록 */
  listPath: string;
}) {
  // 서버 렌더에서는 늘 false다. 쿠키를 렌더 중에 읽으면 하이드레이션이 어긋난다
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(hasAdminUiHint(document.cookie));
  }, []);

  if (!isAdmin) return null;

  return (
    <span className="flex items-center gap-2.5">
      <Link
        href={`/admin/edit/${slug}`}
        rel="nofollow"
        className="border border-edge px-2 py-0.5 font-typewriter text-[10.5px] text-faint hover:text-ink"
      >
        수정
      </Link>

      <DeletePostButton postId={postId} title={title} afterDelete={listPath} />
    </span>
  );
}
