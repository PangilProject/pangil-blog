import { NotFoundNotice } from "@/components/public/NotFoundNotice";

/**
 * 어느 지면에도 속하지 않는 없는 주소(`/nope` 등). 지면 레이아웃이 없으므로 안내만 선다 —
 * 지면 안쪽은 각 세그먼트의 not-found가 받는다.
 */
export const metadata = {
  title: "없는 주소",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-measure px-[6%]">
      <NotFoundNotice />
    </div>
  );
}
