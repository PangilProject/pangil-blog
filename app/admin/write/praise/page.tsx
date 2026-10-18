import { PraiseEditor } from "@/components/editor/PraiseEditor";
import { listDrafts } from "@/lib/db/posts";
import { emptyPraiseForm } from "@/lib/editor/praiseForm";

/** A-06 찬양 에디터 — 새 글 (02 §2.4). 첫 자동 저장에서 초안이 만들어진다 */
export default async function NewPraisePage() {
  const drafts = await listDrafts(50, "PRAISE");

  return <PraiseEditor postId={null} initialValues={emptyPraiseForm()} drafts={drafts} />;
}
