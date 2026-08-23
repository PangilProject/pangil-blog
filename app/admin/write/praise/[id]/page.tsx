import { notFound } from "next/navigation";

import { PraiseEditor } from "@/components/editor/PraiseEditor";
import { findEditablePost } from "@/lib/db/posts";
import { fromDraftContent } from "@/lib/editor/praiseForm";

/** A-06 찬양 에디터 — 이어쓰기·수정 (02 §2.4) */
export default async function EditPraisePage({ params }: PageProps<"/admin/write/praise/[id]">) {
  const { id } = await params;
  const post = await findEditablePost(id);

  if (post?.type !== "PRAISE") notFound();

  return (
    <PraiseEditor
      postId={post.id}
      initialValues={fromDraftContent(post.content.ok ? post.content.content : null, post.title)}
    />
  );
}
