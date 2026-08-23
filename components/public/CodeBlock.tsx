import { CopyButton } from "@/components/public/CopyButton";
import { languageLabel } from "@/lib/render/languageLabel";

/**
 * 코드 블록 (03 §3.2 · 04 §3.2) — 먹 배경 위의 코드.
 *
 * 상단에 언어 라벨(타자기체) + 복사 버튼. 하이라이팅된 HTML은 서버에서 이미 만들어져 오고,
 * 없으면 평문으로 그린다 — 하이라이팅이 안 되는 것과 코드가 안 보이는 것은 급이 다르다.
 */
export function CodeBlock({
  code,
  language,
  html,
}: {
  code: string;
  language: string | null;
  /** Shiki가 만든 `<pre>` HTML. null이면 평문 */
  html: string | null;
}) {
  const label = languageLabel(language);

  return (
    <div className="my-[1.4em] border border-[#3a3630] bg-ink">
      <div className="flex items-center justify-between border-[#3a3630] border-b px-3.5 py-1.5">
        <span className="font-typewriter text-[10.5px] text-[#8B8474]">{label ?? "code"}</span>
        <CopyButton code={code} />
      </div>

      {html ? (
        // Shiki 출력은 우리 서버에서 만든 HTML이다 — 사용자 입력을 그대로 넣는 경로가 아니다
        // biome-ignore lint/security/noDangerouslySetInnerHtml: 서버에서 생성한 하이라이팅 HTML
        <div className="record-code" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="record-code-plain">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
