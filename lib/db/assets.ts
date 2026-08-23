import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * 업로드한 이미지 기록 (05 §1.4 Asset).
 *
 * 원본 폭·높이를 함께 남기는 이유는 next/image가 그걸 요구하기 때문이다(04 §3.3). 크기는
 * **브라우저가 재서 보낸다** — 서버에서 이미지 헤더를 파싱하는 코드를 두는 것보다, 이미 파일을
 * 들고 있는 쪽이 재는 게 정확하고 짧다. 1인 관리 화면이라 신뢰 경계 문제도 아니다(값은 범위만
 * 검증한다).
 *
 * postId가 null인 행은 아직 저장되지 않은 새 글에서 올린 것이다(orphan). 초안이 만들어진 뒤
 * 연결하지 않는다 — 지금 필요한 건 "이 이미지가 우리 것"이라는 기록뿐이고, 정리는 M6의
 * 무결성 점검(06 §8) 몫이다.
 */
export type CreateAssetInput = {
  postId: string | null;
  storagePath: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  bytes: number;
};

export async function createAsset(input: CreateAssetInput) {
  return prisma.asset.create({
    data: input,
    select: { id: true, storagePath: true },
  });
}
