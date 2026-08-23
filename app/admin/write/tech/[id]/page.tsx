import { notFound } from "next/navigation";

import { TechEditor } from "@/components/editor/TechEditor";
import { listCategories } from "@/lib/db/categories";
import { findEditablePost, findPostTagNames } from "@/lib/db/posts";
import { fromDraftContent } from "@/lib/editor/techForm";

/** A-07 기술 에디터 — 이어쓰기·수정 (02 §2.4) */
export default async function EditTechPage({ params }: PageProps<"/admin/write/tech/[id]">) {
  const { id } = await params;
  const [post, categories] = await Promise.all([findEditablePost(id), listCategories()]);

  if (post?.type !== "TECH") notFound();

  const tags = await findPostTagNames(post.id);

  return (
    <TechEditor
      postId={post.id}
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
