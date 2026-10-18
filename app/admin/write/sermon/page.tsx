import { SermonEditor } from "@/components/editor/SermonEditor";
import { listDrafts } from "@/lib/db/posts";
import { emptySermonForm } from "@/lib/editor/sermonForm";

/**
 * A-05 설교 에디터 — 새 글 (02 §2.4).
 * 첫 자동 저장에서 초안이 만들어지고 URL이 /admin/write/sermon/{id}로 교체된다.
 */
export default async function NewSermonPage() {
  const drafts = await listDrafts(50, "SERMON");

  return <SermonEditor postId={null} initialValues={emptySermonForm()} drafts={drafts} />;
}
