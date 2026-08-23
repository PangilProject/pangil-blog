import Link from "next/link";

/**
 * H-02 개인정보처리방침 (02 §2.4 · 05 §4).
 *
 * 통계 수집 고지의 최소본이다. 전 사이트 공용이고 하단의 조용한 링크로만 들어온다.
 *
 * **아직 수집하지 않는 것을 수집한다고 적지 않는다.** 통계 수집은 M6에서 붙으므로, 그 사실을
 * 그대로 쓴다 — 방침 문서가 실제와 어긋나는 것이 가장 나쁘다.
 */
export const metadata = {
  title: "개인정보처리방침",
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-measure flex-col gap-6 px-[6%] py-16">
      <h1 className="font-serif font-bold text-[22px]">개인정보처리방침</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-typewriter text-[11px] tracking-[0.14em] text-faint">수집하는 것</h2>
        <p className="text-[14px] leading-body text-ink-soft">
          방문 통계를 위해 접속 경로(페이지 주소), 유입 경로(referrer·utm), 기기
          구분(모바일/데스크탑), 그리고{" "}
          <b className="text-ink">되돌릴 수 없게 해시한 방문자 구분값</b>을 남깁니다. 해시는 날마다
          새로 만들어지므로 어제와 오늘의 방문을 같은 사람으로 이을 수 없습니다.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-typewriter text-[11px] tracking-[0.14em] text-faint">
          수집하지 않는 것
        </h2>
        <p className="text-[14px] leading-body text-ink-soft">
          쿠키를 심지 않습니다. 이름·이메일·IP 주소를 그대로 저장하지 않고, 광고·분석 도구를 붙이지
          않습니다. 로그인 기능은 운영자 한 사람을 위한 것이며 방문자에게는 열려 있지 않습니다.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-typewriter text-[11px] tracking-[0.14em] text-faint">쓰는 목적</h2>
        <p className="text-[14px] leading-body text-ink-soft">
          어떤 글이 읽히는지 알기 위해서입니다. 그 외의 목적으로 쓰지 않고, 제3자에게 넘기지
          않습니다.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-typewriter text-[11px] tracking-[0.14em] text-faint">문의</h2>
        <p className="text-[14px] leading-body text-ink-soft">
          이 방침에 대한 문의는 허브에 적힌 링크로 연락해 주세요.
        </p>
      </section>

      <p className="border-edge border-t pt-4 font-typewriter text-[10.5px] text-faint">
        통계 수집은 사이트 공개 시점부터 적용됩니다. 그 전까지는 아무것도 수집하지 않습니다.
      </p>

      <Link href="/hub" className="font-typewriter text-[11px] text-faint hover:text-ink">
        ← 허브로
      </Link>
    </main>
  );
}
