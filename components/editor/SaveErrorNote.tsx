/**
 * 저장 실패 사유 (04 §2.2).
 *
 * 상태 기계는 포기하지 않고 재시도하지만, "동기화 대기"만 보이면 작성자가 할 수 있는 일이
 * 없다. 1인 도구이므로 사유를 그대로 보여주는 편이 낫다 — 스크린샷 한 장으로 원인이 잡힌다.
 * 재시도 중이라는 사실은 인디케이터가 이미 말하므로, 여기서는 사유만 적는다.
 */
export function SaveErrorNote({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <span role="status" className="font-typewriter text-[10.5px] text-(--accent)">
      {message}
    </span>
  );
}
