import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminFooter } from "@/components/admin/AdminFooter";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminPostList } from "@/components/admin/AdminPostList";
import { FilterMenu, TabMenu } from "@/components/admin/FilterMenu";
import { type DividerTabItem, DividerTabs } from "@/components/record/DividerTabs";
import { Pagination } from "@/components/record/Pagination";
import { Button } from "@/components/ui/button";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { getAdminUser } from "@/lib/auth/adminSession";
import { listCategories } from "@/lib/db/categories";
import { listAdminPosts } from "@/lib/db/posts";
import { FAITH_TYPES, TYPE_LABELS } from "@/lib/record/axis";
import type { RecordType } from "@/lib/record/callNumber";
import { UNCATEGORIZED_KEY, UNCATEGORIZED_LABEL } from "@/lib/record/category";
import { editorPath } from "@/lib/record/todayCard";

/**
 * A-03 글 관리 (02 §2.4).
 *
 * **분류 탭은 다섯 칸이다**(2026-10-05): 전체 · 큐티 · 설교 · 찬양 · 기술 ▾. 기술 칸은 카테고리를
 * 접은 메뉴라 누르면 회고·FE·…·미분류가 바로 열린다. 전에는 `기술` 탭을 누르면 카테고리 탭 줄이
 * 하나 더 열려 두 번 눌렀고, 그걸 한 줄로 다 폈더니 카테고리가 늘수록 줄이 길어졌다.
 * 카테고리를 고르면 기술 글로 좁혀진다(카테고리는 TECH 전용 컬럼이다, 02 §5.5).
 *
 * 필터는 URL이다 — 공개 목록과 같은 규칙이고(02 §2.3), 그래서 이 화면에 JS가 없다.
 *
 * 초안은 여기 없다. 초안함(A-02)이 "이어서 쓸 것"이라는 다른 질문에 답한다.
 */

// 축 정의는 lib/record/axis 하나다 — 공개 목록·상세와 같은 것을 본다
const FAITH_TABS = FAITH_TYPES.map((type) => ({ label: TYPE_LABELS[type], type }));

/** `?type=`은 faith 타입을 받는다. 기술은 `?category=`로 고른다 — `TECH`는 옛 주소를 위해 남긴다 */
function parseType(value: unknown): RecordType | null {
  if (value === "TECH") return "TECH";
  return FAITH_TABS.find((tab) => tab.type === value)?.type ?? null;
}

/**
 * 이 지면은 `searchParams`를 읽는다 — 요청이 있어야 무엇을 그릴지 정해진다. 그래서 즉시
 * 전환용 껍데기를 미리 만들 수 없고, Next가 개발 중에 그 사실을 인사이트로 알린다.
 * 공개 목록도 같은 이유로 같은 선언을 갖고 있다(04 ADR-003).
 */
export const instant = false;

export default async function AdminPostsPage({ searchParams }: PageProps<"/admin/posts">) {
  const user = await getAdminUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);

  const params = await searchParams;
  // 카테고리를 고르면 곧 기술 글이다 — 카테고리는 TECH 전용 컬럼이다
  const categorySlug = typeof params.category === "string" ? params.category : null;
  const type = categorySlug
    ? "TECH"
    : parseType(typeof params.type === "string" ? params.type : null);
  const query = typeof params.q === "string" ? params.q : undefined;
  const page = Number(typeof params.page === "string" ? params.page : 1) || 1;

  const [list, categories] = await Promise.all([
    listAdminPosts({ type, categorySlug, query, page }),
    listCategories(),
  ]);

  const hrefFor = (next: { type?: RecordType | null; category?: string | null; page?: number }) => {
    const search = new URLSearchParams();
    const nextType = next.type === undefined ? type : next.type;
    const nextCategory = next.category === undefined ? categorySlug : next.category;

    // 카테고리가 있으면 그것만 적는다 — 타입(TECH)은 거기서 따라온다
    if (nextCategory) search.set("category", nextCategory);
    else if (nextType) search.set("type", nextType);
    // 검색어는 축을 바꿔도 남는다 — "이 말이 든 글을 타입별로 훑는" 것이 실제 사용이다
    if (query) search.set("q", query);
    if (next.page && next.page > 1) search.set("page", String(next.page));

    const suffix = search.toString();
    return suffix === "" ? "/admin/posts" : `/admin/posts?${suffix}`;
  };

  // 축을 바꾸면 1페이지로 돌아간다 — 3페이지짜리 필터에서 20페이지를 요구하면 빈 목록이다
  const faithTabs: DividerTabItem[] = [
    {
      label: "전체",
      href: hrefFor({ type: null, category: null, page: 1 }),
      active: type === null,
    },
    ...FAITH_TABS.map((tab) => ({
      label: tab.label,
      href: hrefFor({ type: tab.type, category: null, page: 1 }),
      active: type === tab.type,
    })),
  ];

  // 기술은 카테고리를 하나의 탭(`기술 ▾`)에 접는다 — 카테고리가 늘어도 탭 줄은 길어지지 않는다.
  // `기술 전체`는 두지 않는다: 탭이 `기술 · 기술 전체`로 길어졌고, 기술 글 전부는 `전체`로 본다.
  // 미분류는 공개 지면의 분류가 아니지만 남긴다 — 분류를 지우며 생긴 글을 찾을 곳이 여기뿐이다
  const techItems: DividerTabItem[] = [
    ...categories.map((category) => ({
      label: category.name,
      href: hrefFor({ type: null, category: category.slug, page: 1 }),
      active: categorySlug === category.slug,
    })),
    {
      label: UNCATEGORIZED_LABEL,
      href: hrefFor({ type: null, category: UNCATEGORIZED_KEY, page: 1 }),
      active: categorySlug === UNCATEGORIZED_KEY,
    },
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

        {/* 검색은 폼 하나다 — 공개 목록과 같은 문법이고, 이 화면에도 JS를 늘리지 않는다.
            필터는 유지한다: 폼이 감춘 값으로 함께 보낸다 */}
        <form action="/admin/posts" className="flex items-center gap-2 border-edge border-b pb-1.5">
          {categorySlug ? (
            <input type="hidden" name="category" value={categorySlug} />
          ) : (
            type && <input type="hidden" name="type" value={type} />
          )}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="제목·내용 검색"
            aria-label="검색어"
            className="min-w-0 flex-1 bg-transparent font-typewriter text-[12px] outline-none placeholder:text-faint"
          />
          {/* 공개 목록과 같은 버튼이다(ListHeader) — 글자처럼 서 있으면 누를 것으로 읽히지 않았다 */}
          <Button type="submit" size="sm" className="rounded-none">
            찾기
          </Button>
        </form>

        {/*
          넓은 화면은 탭 다섯 칸(기술은 카테고리를 접은 메뉴 탭), 좁은 화면은 드롭다운 하나다.
          분류를 한 줄로 다 펴면 카테고리가 늘수록 줄이 길어지고, 좁은 화면에서는 세 줄이 됐다
        */}
        <DividerTabs
          items={faithTabs}
          label="분류 필터"
          className="hidden sm:block"
          trailing={<TabMenu label="기술" items={techItems} />}
        />
        <FilterMenu items={[...faithTabs, ...techItems]} label="분류 필터" className="sm:hidden" />

        {list.posts.length === 0 ? (
          <p className="text-sm text-ink-soft">
            {query ? `"${query}" 결과가 없어요.` : "이 조건에 맞는 글이 없어요."}
          </p>
        ) : (
          // 필터·검색·쪽이 바뀌면 고른 것을 비운다 — 다른 쪽에서 고른 글이 보이지 않는 채로 남으면
          // "3편 선택됨"이 눈앞에 없는 글까지 세고, 일괄 삭제가 그 글까지 지운다
          <AdminPostList
            key={`${type ?? ""}:${categorySlug ?? ""}:${query ?? ""}:${list.page}`}
            posts={list.posts.map((post) => ({
              id: post.id,
              title: post.title,
              // 줄 앞에는 분류를 적는다 — 묵상은 큐티·설교·찬양, 기술은 카테고리. 필터 탭과 같은
              // 말이라 "이 글이 어느 탭에 있나"가 바로 읽힌다. 청구기호(QT-0201)는 찾는 단서가
              // 아니었다: 글은 제목으로 찾고, 번호는 공개 지면의 이력이다
              categoryLabel:
                post.type === "TECH"
                  ? (post.categoryName ?? UNCATEGORIZED_LABEL)
                  : TYPE_LABELS[post.type],
              editorHref: editorPath(post.type, post.id),
              status: post.status === "PRIVATE" ? "PRIVATE" : "PUBLISHED",
            }))}
          />
        )}

        <Pagination
          page={list.page}
          pageCount={list.pageCount}
          hrefFor={(target) => hrefFor({ page: target })}
        />
      </main>
      <AdminFooter />
    </div>
  );
}
