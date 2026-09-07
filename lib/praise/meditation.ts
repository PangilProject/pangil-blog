import type { TiptapDoc } from "@/lib/content/schema";

/**
 * 감춘 묵상 덩이 하나 — 자리 번호는 에디터에서 몇째 덩이였는지다 (02 §5.4).
 *
 * 타입이 액션 파일이 아니라 여기 있는 이유: 이 값을 받는 쪽이 **클라이언트 아일랜드**다.
 * 아일랜드가 `"use server"` 모듈을 import하면 그 모듈 그래프(Prisma까지)가 클라이언트로
 * 딸려온다 — M3에서 실제로 테스트 다섯 개가 그렇게 깨졌다(04 §3.3의 의존 방향 뒤집기).
 */
export type HiddenMeditationBlock = { index: number; doc: TiptapDoc };
