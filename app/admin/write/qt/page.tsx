import { QtEditor } from "@/components/editor/QtEditor";
import { emptyQtForm } from "@/lib/editor/qtForm";

/**
 * A-04 QT 에디터 — 새 글 (02 §2.4).
 *
 * 목표 동작은 이 경로가 아니다. 평일 아침에는 크롤러가 만들어둔 초안을 A-01에서 열고(06 §2),
 * 이 경로는 크롤러가 실패한 날이나 지난 날짜를 손으로 적을 때 쓴다 — 그때는 4그룹 프리셋이
 * 빈 칸으로 열린다.
 */
export default function NewQtPage() {
  return <QtEditor postId={null} initialValues={emptyQtForm()} />;
}
