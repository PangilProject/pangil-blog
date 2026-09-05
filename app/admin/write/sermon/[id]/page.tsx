import { notFound } from "next/navigation";

import { SermonEditor } from "@/components/editor/SermonEditor";
import { findEditablePost, findPostTagNames } from "@/lib/db/posts";
import { fromDraftContent } from "@/lib/editor/sermonForm";

/**
 * A-05 설교 에디터 — 이어쓰기·수정 (02 §2.4 "에디터 4종이 신규/수정 모드를 겸한다").
 *
 * content가 스키마를 통과하지 못하면 빈 폼으로 시작한다. 로컬 미러에 최신 내용이 있으면
 * 복구 배너가 뜨므로(04 §2.3), 깨진 서버 값 때문에 작성자가 막히지는 않는다.
 */
export default async function EditSermonPage({ params }: PageProps<"/admin/write/sermon/[id]">) {
  const { id } = await params;
  const post = await findEditablePost(id);

  if (post?.type !== "SERMON") notFound();

  const tags = await findPostTagNames(post.id);

  return (
    <SermonEditor
      postId={post.id}
      isDraft={post.status === "DRAFT"}
      initialValues={fromDraftContent(
        post.content.ok ? post.content.content : null,
        post.title,
        tags,
      )}
    />
  );
}
