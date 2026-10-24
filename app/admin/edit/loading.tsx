import { EditorSkeleton } from "@/components/editor/EditorSkeleton";

/**
 * 공개 상세의 `수정`을 누른 뒤. 이 경로는 화면이 아니라 slug를 에디터 주소로 바꿔 보내는 경유지다
 * (edit/[slug]). 곧 에디터가 서므로 같은 틀을 보인다 — 다른 모양이 한 번 끼면 그게 깜빡임이다.
 */
export default function AdminEditLoading() {
  return <EditorSkeleton />;
}
