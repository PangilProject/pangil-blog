import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/AdminNav";
import { DeletePostButton } from "@/components/admin/DeletePostButton";
import { type DividerTabItem, DividerTabs } from "@/components/record/DividerTabs";
import { Pagination } from "@/components/record/Pagination";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { getAdminUser } from "@/lib/auth/adminSession";
import { listCategories } from "@/lib/db/categories";
import { listAdminPosts } from "@/lib/db/posts";
import { formatCallNumber, type RecordType } from "@/lib/record/callNumber";
import { editorPath } from "@/lib/record/todayCard";

/**
 * A-03 글 관리 (02 §2.4).
 *
 * 두 축으로 걸러 본다 — faith의 분류는 **타입**이고, dev의 분류는 **카테고리**다(02 §5).
 * 카테고리 축은 기술을 골랐을 때만 놓는다. TECH 전용 컬럼이라(02 §5.5) 다른 타입에서는
 * 늘 빈 결과가 되고, 누를 수 있는 빈 필터는 고장으로 읽힌다.
 *
 * 필터는 URL이다 — 공개 목록과 같은 규칙이고(02 §2.3), 그래서 이 화면에 JS가 없다.
 *
 * 초안은 여기 없다. 초안함(A-02)이 "이어서 쓸 것"이라는 다른 질문에 답한다.
 */

const TYPE_TABS: { label: string; type: RecordType | null }[] = [
  { label: "전체", type: null },
  { label: "큐티", type: "QT" },
  { label: "설교", type: "SERMON" },
  { label: "찬양", type: "PRAISE" },
  { label: "기술", type: "TECH" },
];

function parseType(value: unknown): RecordType | null {
  return TYPE_TABS.find((tab) => tab.type === value)?.type ?? null;
}

export default async function AdminPostsPage({ searchParams }: PageProps<"/admin/posts">) {
  const user = await getAdminUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);

  const params = await searchParams;
  const type = parseType(typeof params.type === "string" ? params.type : null);
  // 카테고리는 기술 축 안에서만 뜻이 있다 — 타입을 바꾸면 함께 떨어진다
  const categorySlug =
    type === "TECH" && typeof params.category === "string" ? params.category : null;
  const page = Number(typeof params.page === "string" ? params.page : 1) || 1;

  const [list, categories] = await Promise.all([
    listAdminPosts({ type, categorySlug, page }),
    type === "TECH" ? listCategories() : Promise.resolve([]),
  ]);

  const hrefFor = (next: { type?: RecordType | null; category?: string | null; page?: number }) => {
    const search = new URLSearchParams();
    const nextType = next.type === undefined ? type : next.type;
    const nextCategory = next.category === undefined ? categorySlug : next.category;

    if (nextType) search.set("type", nextType);
    if (nextType === "TECH" && nextCategory) search.set("category", nextCategory);
    if (next.page && next.page > 1) search.set("page", String(next.page));

    const query = search.toString();
    return query === "" ? "/admin/posts" : `/admin/posts?${query}`;
  };

  const typeTabs: DividerTabItem[] = TYPE_TABS.map((tab) => ({
    label: tab.label,
    // 축을 바꾸면 1페이지로 돌아간다 — 3페이지짜리 필터에서 20페이지를 요구하면 빈 목록이다
    href: hrefFor({ type: tab.type, category: null, page: 1 }),
    active: type === tab.type,
  }));

  const categoryTabs: DividerTabItem[] = [
    { label: "전체", href: hrefFor({ category: null, page: 1 }), active: categorySlug === null },
    ...categories.map((category) => ({
      label: category.name,
      href: hrefFor({ category: category.slug, page: 1 }),
      active: categorySlug === category.slug,
    })),
  ];

  return (
    <div className="flex min-h-full flex-col bg-paper">
      <AdminNav />

      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-[5%] py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-serif text-lg">글 관리</h1>
          <p className="font-typewriter text-[11px] text-faint">
            {list.total}편 · 이어서 쓸 초안은{" "}
            <Link href="/admin/drafts" className="text-ink hover:underline">
              초안함
            </Link>
            에 있어요
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <DividerTabs items={typeTabs} label="글 타입 필터" />
          {type === "TECH" && categories.length > 0 && (
            <DividerTabs items={categoryTabs} label="카테고리 필터" />
          )}
        </div>

        {list.posts.length === 0 ? (
          <p className="text-sm text-ink-soft">이 조건에 맞는 글이 없어요.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-edge border border-edge bg-card">
            {list.posts.map((post) => (
              <li key={post.id} className="flex flex-wrap items-baseline gap-3 px-4 py-3">
                {/* TECH는 카테고리를 청구기호에 병기한다 — 공개 목록과 같은 표기다(03 §5.2) */}
                <span className="w-[120px] font-typewriter text-[10.5px] text-(--accent)">
                  {formatCallNumber({
                    type: post.type,
                    callNumber: post.callNumber,
                    categoryName: post.categoryName,
                  })}
                </span>
                <Link
                  href={editorPath(post.type, post.id)}
                  className="flex-1 text-[14px] hover:underline"
                >
                  {post.title || "제목 없음"}
                </Link>
                {/* 발행된 글이 대다수라 상태를 매 줄에 적으면 그게 배경이 된다.
                    내려둔 글만 표시한다 — 03 §7 문구 규약: 구현 용어(PRIVATE)는 쓰지 않는다 */}
                {post.status === "PRIVATE" && (
                  <span className="font-typewriter text-[10.5px] text-(--accent)">비공개</span>
                )}
                <DeletePostButton postId={post.id} title={post.title} />
              </li>
            ))}
          </ul>
        )}

        <Pagination
          page={list.page}
          pageCount={list.pageCount}
          hrefFor={(target) => hrefFor({ page: target })}
        />
      </main>
    </div>
  );
}
