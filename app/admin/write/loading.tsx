import { EditorSkeleton } from "@/components/editor/EditorSkeleton";

/**
 * 에디터로 들어가는 동안 (A-02 · A-03).
 *
 * **이 파일은 write/ 에만 있다. `write/tech/` 같은 타입 폴더에 두지 않는다.** 새 글은 첫 서버
 * 저장에서 id를 받으면 `router.replace`로 `/write/tech/{id}`로 옮겨 간다(TechEditor `adoptId` 외 셋).
 * loading.tsx는 그 폴더의 자식 세그먼트마다 새 경계를 세우므로, 타입 폴더에 두면 그 순간
 * `__PAGE__ → [id]`가 새 경계가 되어 **쓰고 있는 에디터가 이 틀로 덮인다** — 입력이 끊기고
 * 포커스가 날아간다. write/ 에 두면 그 이동은 같은 자식(`tech`) 안의 일이라 경계가 다시 서지 않고,
 * Next가 지금 에디터를 남긴 채 새 화면을 기다린다.
 *
 * 그래서 이 틀이 서는 것은 **바깥에서 에디터로 들어올 때**와, 빈 초안에서 묵상 서식을 바꿀 때
 * (FaithFormatTabs — 아직 친 것이 없어 잃을 것도 없다)뿐이다. 이 규칙은
 * lib/site/loadingBoundaries.test.ts가 잠근다.
 */
export default function AdminWriteLoading() {
  return <EditorSkeleton />;
}
