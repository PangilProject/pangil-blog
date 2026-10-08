/**
 * 칸 손잡이의 그림 — 창 하나에 칸 선 하나 (2026-10-08).
 *
 * `«` `»`는 타자기체 글자라 같은 줄의 밝기 토글(선 그림)과 다른 물건으로 읽혔고, 방향을 한 번
 * 풀어 읽어야 했다. 창에 칸을 그으면 **무엇을 접는지**가 그림으로 선다.
 *
 * **펼쳐져 있으면 그 칸이 옅게 찬다.** 접히면 빈 칸만 남는다 — 지금 상태가 그림에 있다.
 * 밝기 토글과 같은 결이다: 선 1.7, 둥근 끝.
 */
export function PanelIcon({ side, open }: { side: "left" | "right"; open: boolean }) {
  const line = side === "left" ? 9 : 15;
  const fillX = side === "left" ? 4.6 : 15.6;

  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d={`M${line} 4.5v15`} />
      {open && (
        <rect
          x={fillX}
          y="5.6"
          width="3.8"
          height="12.8"
          rx="0.8"
          fill="currentColor"
          stroke="none"
          opacity="0.28"
        />
      )}
    </svg>
  );
}
