import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { findProject, projects } from "@/lib/site/projectContent";
import { siteHref } from "@/lib/site/publicUrl";

/**
 * H-04 작업물 상세 (ADR-005).
 *
 * 축은 **"이 서비스가 무엇인가"** 다. 허브 `장 넷 · 만든 것`이 적는 "무엇을 버렸는가"와
 * 겹치지 않게 갈라 뒀다 — 같은 문장이 두 군데 살면 한쪽이 낡는다.
 *
 * **비어 있는 블록은 그리지 않는다.** 스크린샷이 없어도, 링크가 없어도 지면이 깨지지 않아야
 * `projectContent.ts`를 편하게 고칠 수 있다.
 *
 * 화면 넘김은 `scroll-snap`이다. 라이트박스를 쓰면 공개 아일랜드가 8개가 되고,
 * 그건 ADR-005가 걸지 않기로 한 값이다(04 §3.6).
 */

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = findProject(slug);

  if (!project) return {};

  return {
    title: project.title,
    description: project.tagline,
  };
}

/** 소제목. 본문 위에 서는 작은 활자 한 줄 */
function SectionLabel({ children }: { children: string }) {
  return <h2 className="font-typewriter text-[11px] tracking-[0.14em] text-faint">{children}</h2>;
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = findProject(slug);

  if (!project) notFound();

  const index = projects.findIndex((item) => item.slug === project.slug);
  const previous = projects[index - 1];
  const next = projects[index + 1];

  return (
    <main className="mx-auto flex w-full max-w-[860px] flex-col px-[6%] py-16 lg:px-10">
      <Link
        href={siteHref("hub", "/hub/project", { from: "hub" })}
        className="font-typewriter text-[11px] text-faint hover:text-ink"
      >
        ← 작업물
      </Link>

      <header className="mt-8 flex flex-col gap-4">
        <p className="font-typewriter text-[11px] tracking-[0.12em] text-faint">
          {project.call} · {project.kind}
        </p>

        <h1 className="font-serif font-bold text-[30px] leading-tight">{project.title}</h1>
        <p className="max-w-measure text-[15px] leading-body text-ink-soft">{project.tagline}</p>

        {/* 읽는 사람이 가장 먼저 필요한 사실 넷. 표가 아니라 줄로 둔다 */}
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 font-typewriter text-[11px] sm:grid-cols-[auto_1fr_auto_1fr]">
          <dt className="text-faint">기간</dt>
          <dd className="text-ink-soft">{project.period}</dd>
          <dt className="text-faint">상태</dt>
          <dd className="text-ink-soft">{project.status}</dd>
          <dt className="text-faint">구성</dt>
          <dd className="text-ink-soft">{project.team}</dd>
          <dt className="text-faint">역할</dt>
          <dd className="text-ink-soft">{project.role}</dd>
        </dl>

        {project.links.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-x-5 gap-y-2 font-typewriter text-[11px]">
            {project.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink underline decoration-1 underline-offset-4 hover:text-site-accent"
              >
                {link.label} ↗
              </a>
            ))}
          </p>
        )}
      </header>

      <section className="mt-12 flex flex-col gap-3 border-line border-t pt-7">
        <SectionLabel>개요</SectionLabel>
        {project.summary.map((paragraph) => (
          <p key={paragraph} className="max-w-measure text-[14px] leading-body text-ink-soft">
            {paragraph}
          </p>
        ))}
      </section>

      {project.shots.length > 0 && (
        <section className="mt-12 flex flex-col gap-4 border-line border-t pt-7">
          <SectionLabel>화면</SectionLabel>
          {/* 좌우로 밀어 넘긴다. 한 장씩 물리도록 snap을 건다 */}
          <ul className="-mx-[6%] flex snap-x snap-mandatory gap-4 overflow-x-auto px-[6%] pb-3 lg:mx-0 lg:px-0">
            {project.shots.map((shot) => (
              <li
                key={shot.src}
                className="flex w-[78%] shrink-0 snap-center flex-col gap-2 sm:w-[60%]"
              >
                <Image
                  src={shot.src}
                  alt={shot.alt}
                  width={shot.width}
                  height={shot.height}
                  className="h-auto w-full border border-line"
                />
                {shot.caption && (
                  <p className="font-typewriter text-[11px] text-faint">{shot.caption}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {project.features.length > 0 && (
        <section className="mt-12 flex flex-col gap-4 border-line border-t pt-7">
          <SectionLabel>기능</SectionLabel>
          <ul className="flex flex-col">
            {project.features.map((feature) => (
              <li
                key={feature.name}
                className="flex flex-col gap-1.5 border-line border-b py-4 last:border-b-0 sm:flex-row sm:gap-8"
              >
                <h3 className="shrink-0 font-serif font-bold text-[14px] text-ink sm:w-[168px]">
                  {feature.name}
                </h3>
                <p className="min-w-0 text-[14px] leading-body text-ink-soft">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {project.stack.length > 0 && (
        <section className="mt-12 flex flex-col gap-4 border-line border-t pt-7">
          <SectionLabel>기술 스택</SectionLabel>
          <dl className="flex flex-col gap-3">
            {project.stack.map((group) => (
              <div key={group.group} className="flex flex-col gap-1 sm:flex-row sm:gap-8">
                <dt className="shrink-0 font-typewriter text-[11px] text-faint sm:w-[168px] sm:pt-0.5">
                  {group.group}
                </dt>
                <dd className="min-w-0 font-typewriter text-[12px] leading-body text-ink-soft">
                  {group.items.join(" · ")}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {project.notes && project.notes.length > 0 && (
        <section className="mt-12 flex flex-col gap-3 border-line border-t pt-7">
          <SectionLabel>만들면서</SectionLabel>
          {project.notes.map((note) => (
            <p key={note} className="max-w-measure text-[14px] leading-body text-ink-soft">
              {note}
            </p>
          ))}
        </section>
      )}

      {/* 앞뒤로 넘기는 길. 목록으로 돌아갔다 다시 들어오게 하지 않는다 */}
      <nav className="mt-16 flex gap-6 border-line border-t pt-7 font-typewriter text-[11px]">
        {previous && (
          <Link
            href={siteHref("hub", `/hub/project/${previous.slug}`, { from: "hub" })}
            className="flex min-w-0 flex-col gap-1 text-faint hover:text-ink"
          >
            <span>← 앞</span>
            <span className="truncate text-ink-soft">{previous.title}</span>
          </Link>
        )}
        {next && (
          <Link
            href={siteHref("hub", `/hub/project/${next.slug}`, { from: "hub" })}
            className="ml-auto flex min-w-0 flex-col items-end gap-1 text-faint hover:text-ink"
          >
            <span>뒤 →</span>
            <span className="truncate text-ink-soft">{next.title}</span>
          </Link>
        )}
      </nav>
    </main>
  );
}
