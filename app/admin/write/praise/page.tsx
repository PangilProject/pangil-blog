import { PraiseEditor } from "@/components/editor/PraiseEditor";
import { emptyPraiseForm } from "@/lib/editor/praiseForm";

/** A-06 찬양 에디터 — 새 글 (02 §2.4). 첫 자동 저장에서 초안이 만들어진다 */
export default function NewPraisePage() {
  return (
    <PraiseEditor postId={null} initialValues={emptyPraiseForm()} afterPublishHref="/admin/posts" />
  );
}
