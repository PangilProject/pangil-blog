import { TechEditor } from "@/components/editor/TechEditor";
import { listCategories } from "@/lib/db/categories";
import { EMPTY_TECH_FORM } from "@/lib/editor/techForm";

/** A-07 기술 에디터 — 새 글 (02 §2.4) */
export default async function NewTechPage() {
  const categories = await listCategories();

  return (
    <TechEditor
      postId={null}
      initialValues={EMPTY_TECH_FORM}
      categories={categories}
      afterPublishHref="/admin/posts"
    />
  );
}
