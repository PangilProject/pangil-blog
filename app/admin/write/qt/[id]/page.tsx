import { notFound } from "next/navigation";

import { QtEditor } from "@/components/editor/QtEditor";
import { findEditablePost, findPostTagNames } from "@/lib/db/posts";
import { fromDraftContent } from "@/lib/editor/qtForm";

/**
 * 이 지면은 열 때마다 그 글을 읽는다 — 요청이 있어야 무엇을 그릴지 정해진다. 그래서 즉시
 * 전환용 껍데기를 미리 만들 수 없고, Next가 개발 중에 매 이동마다 그 사실을 인사이트로
 * 알린다(04 ADR-003). 관리 목록도 같은 이유로 같은 선언을 갖고 있다.
 */
export const instant = false;

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

  const tags = await findPostTagNames(post.id);

  return (
    <QtEditor
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
