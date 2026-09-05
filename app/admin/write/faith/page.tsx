import { connection } from "next/server";

import { QtEditor } from "@/components/editor/QtEditor";
import { SermonEditor } from "@/components/editor/SermonEditor";
import { emptyQtForm } from "@/lib/editor/qtForm";
import { EMPTY_SERMON_FORM } from "@/lib/editor/sermonForm";
import { isSunday } from "@/lib/record/kst";

/**
 * 묵상 글쓰기 — 하나의 진입 (02 §2.4).
 *
 * 공개 지면의 `글쓰기`가 신앙 지면이면 여기로 온다. **진입은 하나여도 저장 계약은 셋으로
 * 갈린다** — 타입이 content 스키마·청구기호 시퀀스·slug 접두어(`qt-`/`sr-`/`pr-`)를 가르는
 * 축이다(§5). 그래서 에디터를 합치지 않고, 서식 탭이 그 위에 선다(FaithFormatTabs).
 *
 * 기본 서식은 요일이 정한다: **일요일은 설교, 그 외는 큐티.** 근거는 이미 코드에 있다 —
 * 오늘의 카드가 같은 `isSunday`로 "설교·찬양의 날"을 가른다(02 §3.1). 찬양은 기본값이 되지
 * 않는다: 부르는 날이 정해져 있지 않아 요일로 맞힐 수 없다. 탭으로 한 번에 간다.
 *
 * 첫 저장이 일어나면 각 에디터가 자기 타입의 편집 경로로 URL을 바꾼다 — 편집 경로는 계약을
 * 따라 셋 그대로다.
 */
export default async function NewFaithPostPage() {
  // 시계를 읽기 전에 요청을 확보한다. 프리렌더는 재현 가능한 출력만 허용한다(ADR-003)
  await connection();

  if (isSunday(new Date())) {
    return <SermonEditor postId={null} initialValues={EMPTY_SERMON_FORM} />;
  }

  return <QtEditor postId={null} initialValues={emptyQtForm()} />;
}
