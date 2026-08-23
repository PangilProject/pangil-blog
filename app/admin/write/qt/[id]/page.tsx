import { notFound } from "next/navigation";

import { QtEditor } from "@/components/editor/QtEditor";
import { findEditablePost } from "@/lib/db/posts";
import { fromDraftContent } from "@/lib/editor/qtForm";

/**
 * A-04 QT 에디터 — 이어쓰기·수정 (02 §2.4).
 *
 * 크롤러가 만든 초안도 이 경로로 열린다. content가 스키마를 통과하지 못하면 프리셋 빈 폼으로
 * 시작한다 — 깨진 서버 값 때문에 그날 기록이 막히지는 않는다.
 */
export default async function EditQtPage({ params }: PageProps<"/admin/write/qt/[id]">) {
  const { id } = await params;
  const post = await findEditablePost(id);

  if (post?.type !== "QT") notFound();

  return (
    <QtEditor
      postId={post.id}
      initialValues={fromDraftContent(post.content.ok ? post.content.content : null, post.title)}
    />
  );
}
