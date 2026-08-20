/**
 * H — 프로필 허브. 액센트는 faith와 공유하고, 카드 2장에서만 각자의 값을 쓴다(03 §2.1).
 *
 * 무드 오버라이드는 data-site 하나로 끝난다 — CSS가 --accent 한 축만 갈아끼운다.
 * 여기에 사이트별 변수를 더 얹지 않는다(프리모템 #12: 3면이 제각각 어긋나면
 * 하나 고치려고 셋을 고치게 된다).
 */
export default function HubSiteLayout({ children }: LayoutProps<"/hub">) {
  return (
    <div data-site="hub" className="flex min-h-full flex-col">
      {children}
    </div>
  );
}
