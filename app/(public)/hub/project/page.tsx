import Link from "next/link";

import { ProjectShots } from "@/components/hub/ProjectShots";
import { projects } from "@/lib/site/projectContent";
import { siteHref } from "@/lib/site/publicUrl";

/**
 * H-03 작업물 목록 (ADR-005).
 *
 * **카드 그리드를 쓰지 않는다**(03 §1.1 금지 문법). 괘선으로 나눈 세로 목록이다 —
 * 스크린샷이 있는 항목과 없는 항목이 섞이는데, 그리드는 빈 자리를 드러내고
 * 목록은 드러내지 않는다.
 *
 * 클라이언트 코드가 없다. 이 지면이 아일랜드를 늘리지 않는 것이 ADR-005의 조건이다.
 */

export const metadata = {
  title: "작업물",
  description: "김광일이 만든 것들. 어떤 서비스이고, 어떤 기능이 있고, 무엇으로 만들었는지.",
};

export default function ProjectListPage() {
  return (
    <main className="mx-auto flex w-full max-w-[860px] flex-col px-[6%] py-16 lg:px-10">
      <Link
        href={siteHref("hub", "/hub", { from: "hub" })}
        className="font-typewriter text-[11px] text-faint hover:text-ink"
      >
        ← 소개
      </Link>

      <header className="mt-8 flex flex-col gap-3">
        <p className="font-typewriter text-[11px] tracking-[0.14em] text-faint">
          WORKS · 작업물 {projects.length}건
        </p>
        <h1 className="font-serif font-bold text-[28px] leading-tight">만든 것들</h1>
        <p className="max-w-measure text-[14px] leading-body text-ink-soft">
          어떤 서비스이고, 어떤 기능이 있고, 무엇으로 만들었는지 적었습니다. 최근에 손댄 것이 위에
          옵니다.
        </p>
      </header>

      {/* 목록 자체가 괘선이다. 줄 사이의 선이 곧 구분이고, 테두리를 두르지 않는다 */}
      <ol className="mt-10 flex flex-col">
        {projects.map((project) => (
          <li key={project.slug} className="border-line border-t">
            {/*
              **줄 전체를 링크로 두지 않는다.** 왼쪽 칸이 캐러셀이 되면서 그 안에 라디오와
              라벨이 들어갔고, 링크 안에 누를 것을 또 두면 HTML이 성립하지 않는다.
              그래서 제목이 링크를 맡는다.
            */}
            <div className="flex flex-col gap-4 py-7 sm:flex-row sm:gap-8">
              {/*
                대표 화면들. 상세와 같은 장, 같은 순서다 — 눌러서 들어간 사람이 보던 그림이
                그대로 이어진다. **자리는 그림이 없어도 비워 둔다**: 있는 줄과 없는 줄이
                섞일 때 왼쪽 끝이 들쭉날쭉하면 목록이 목록으로 안 읽힌다.
              */}
              <div className="w-full shrink-0 sm:w-[260px]">
                <ProjectShots slug={project.slug} shots={project.shots} variant="list" />
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="font-serif font-bold text-[19px]">
                    <Link
                      href={siteHref("hub", `/hub/project/${project.slug}`, { from: "hub" })}
                      className="text-ink hover:underline hover:decoration-1 hover:underline-offset-4"
                    >
                      {project.title}
                    </Link>
                  </h2>
                  <span className="font-typewriter text-[11px] text-faint">{project.status}</span>
                </div>

                <p className="text-[14px] leading-body text-ink-soft">{project.tagline}</p>

                <p className="font-typewriter text-[11px] text-faint">
                  {project.kind} · {project.period}
                </p>

                <p className="font-typewriter text-[11px] text-faint">
                  {project.stack
                    .flatMap((group) => group.items)
                    .slice(0, 5)
                    .join(" · ")}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <p className="border-line border-t pt-7 font-typewriter text-[11px] text-faint">
        모두 {projects.length}건.
      </p>
    </main>
  );
}
