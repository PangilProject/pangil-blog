import { formatKstDay, isSunday, kstDateKey } from "@/lib/record/kst";

/**
 * 데드맨 스위치의 판단부 (06 §5).
 *
 * 3층 방어 중 ②다. ①(Actions가 실패를 보고)은 **Actions가 돌기라도 했을 때만** 발화한다.
 * 정작 프리모템 #1의 최악은 "아예 안 돎"이다 — Actions 스케줄은 레포가 60일 조용하면
 * 자동으로 꺼진다. 그래서 앱 쪽에서 "오늘 흔적이 있는가"를 따로 본다.
 *
 * 판단을 화면·DB에서 떼어 여기 둔다. 알림이 오지 않는 버그는 알림이 오는 버그보다 훨씬
 * 늦게 발견되므로, 조건은 테스트로 고정해야 한다.
 */

export type WatchdogInput = {
  now: Date;
  /** 오늘의 crawl_runs. 없으면 null — 그게 가장 위험한 상태다 */
  run: { status: "SUCCESS" | "FAILED" | "SKIPPED"; errorMessage?: string | null } | null;
};

export type WatchdogVerdict =
  | { alert: false; reason: "sunday" | "healthy" }
  | { alert: true; message: string };

export function watchdogVerdict({ now, run }: WatchdogInput): WatchdogVerdict {
  // 일요일은 365qt에 큐티가 없다. 없는 것이 정상인 날에 알림을 보내면 알림을 안 읽게 된다
  if (isSunday(now)) return { alert: false, reason: "sunday" };

  if (run?.status === "SUCCESS" || run?.status === "SKIPPED") {
    return { alert: false, reason: "healthy" };
  }

  const state = run ? "실패로 끝남" : "실행 흔적 없음";
  const detail = run?.errorMessage ? ` · ${run.errorMessage}` : "";

  return {
    alert: true,
    message: `🚨 QT 크롤러 미완료 · ${kstDateKey(now)}(${formatKstDay(now)}) · ${state}${detail} · 수동 폴백 필요`,
  };
}
