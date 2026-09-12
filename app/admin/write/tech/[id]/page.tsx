import { notFound } from "next/navigation";

import { TechEditor } from "@/components/editor/TechEditor";
import { listCategories } from "@/lib/db/categories";
import { findEditablePost, findPostTagNames } from "@/lib/db/posts";
import { fromDraftContent } from "@/lib/editor/techForm";

/**
 * 이 지면은 열 때마다 그 글을 읽는다 — 요청이 있어야 무엇을 그릴지 정해진다. 그래서 즉시
 * 전환용 껍데기를 미리 만들 수 없고, Next가 개발 중에 매 이동마다 그 사실을 인사이트로
 * 알린다(04 ADR-003). 관리 목록도 같은 이유로 같은 선언을 갖고 있다.
 */
export const instant = false;

/** A-07 기술 에디터 — 이어쓰기·수정 (02 §2.4) */
export default async function EditTechPage({ params }: PageProps<"/admin/write/tech/[id]">) {
  const { id } = await params;
  const [post, categories] = await Promise.all([findEditablePost(id), listCategories()]);

  if (post?.type !== "TECH") notFound();

  const tags = await findPostTagNames(post.id);

  return (
    <TechEditor
      postId={post.id}
      isDraft={post.status === "DRAFT"}
      initialValues={fromDraftContent(post.content.ok ? post.content.content : null, {
        title: post.title,
        categoryId: post.categoryId,
        excerpt: post.excerpt,
        thumbnailUrl: post.thumbnailUrl,
        tags,
      })}
      categories={categories}
    />
  );
}
