import Link from "next/link";

import { listAdminPosts } from "@/lib/db/posts";
import { formatCallNumber } from "@/lib/record/callNumber";

/**
 * A-03 글 관리 (02 §2.4) — 최소 구현.
 *
 * M2에서는 발행 직후 도착지 역할을 한다. 02 §3.2의 확정은 "발행 직후 공개 페이지로 이동"이고,
 * 공개 상세는 M3에서 생기므로 그때 도착지를 교체한다.
 * 필터·삭제·PRIVATE 전환은 M2 나머지 에디터를 붙인 뒤에 채운다.
 */
export default async function AdminPostsPage() {
  const posts = await listAdminPosts();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <p className="font-typewriter text-[11px] text-faint">A-03</p>
        <h1 className="font-serif text-xl">글 관리</h1>
      </header>

      {posts.length === 0 ? (
        <p className="text-sm text-ink-soft">아직 글이 없어요.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-edge border border-edge bg-card">
          {posts.map((post) => (
            <li key={post.id} className="flex flex-wrap items-baseline gap-3 px-4 py-3">
              <span className="w-[92px] font-typewriter text-[10.5px] text-(--accent)">
                {formatCallNumber({ type: post.type, callNumber: post.callNumber }) ?? "초안"}
              </span>
              <Link
                href={`/admin/write/${post.type.toLowerCase()}/${post.id}`}
                className="flex-1 text-[14px] hover:underline"
              >
                {post.title || "제목 없음"}
              </Link>
              <span className="font-typewriter text-[10.5px] text-faint">{post.status}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
