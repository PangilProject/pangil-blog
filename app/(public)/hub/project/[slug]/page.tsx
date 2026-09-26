import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { findProject, type ProjectShot, projects } from "@/lib/site/projectContent";
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
 * 화면 넘김은 **숨긴 라디오**다(`ProjectShots`). 라이트박스를 쓰면 공개 아일랜드가 8개가 되고,
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

/**
 * 화면 캐러셀. **클라이언트 코드가 없다** — 숨긴 라디오 한 무리가 "몇 번째 장인가"를 들고,
 * 화살표와 썸네일은 그 라디오를 가리키는 `<label>`이다(ADR-005 · globals.css `[data-shots]`).
 *
 * 한 장뿐이면 넘길 것이 없으므로 라디오도 화살표도 썸네일도 그리지 않는다.
 */
function ProjectShots({ slug, shots }: { slug: string; shots: ProjectShot[] }) {
  const many = shots.length > 1;
  const id = (index: number) => `${slug}-shot-${index}`;

  return (
    /*
      `fieldset`인 이유: 라디오 한 무리에 이름을 붙이는 자리가 원래 여기다. `div`에
      `role="radiogroup"`을 얹으면 한 장뿐일 때 라디오 없는 라디오 무리가 되고,
      조건부로 붙이면 정적 검사가 `aria-label`을 지원하지 않는 요소로 읽는다.
      `legend`는 `input`이 아니라 `nth-of-type` 셈에 끼어들지 않는다.
    */
    <fieldset data-shots className="flex min-w-0 flex-col gap-3">
      <legend className="sr-only">화면</legend>

      {many &&
        shots.map((shot, index) => (
          <input
            key={shot.src}
            id={id(index)}
            name={`${slug}-shot`}
            type="radio"
            defaultChecked={index === 0}
            className="sr-only"
            aria-label={`${index + 1}번째 화면`}
          />
        ))}

      {/* 무대. 넘치는 쪽을 잘라 한 장만 세운다 */}
      <div className="relative overflow-hidden border border-line has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-site-accent has-[:focus-visible]:outline-offset-2">
        <ul data-shot-track>
          {shots.map((shot, index) => (
            <li key={shot.src} data-shot-slide>
              <Image
                src={shot.src}
                alt={shot.alt}
                width={shot.width}
                height={shot.height}
                className="h-auto w-full"
                priority={index === 0}
              />

              {many && index > 0 && (
                <label
                  htmlFor={id(index - 1)}
                  className="absolute top-1/2 left-3 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center border border-edge-strong bg-paper font-typewriter text-[13px] text-ink hover:bg-surface-sheet"
                >
                  ←<span className="sr-only">이전 화면</span>
                </label>
              )}

              {many && index < shots.length - 1 && (
                <label
                  htmlFor={id(index + 1)}
                  className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center border border-edge-strong bg-paper font-typewriter text-[13px] text-ink hover:bg-surface-sheet"
                >
                  →<span className="sr-only">다음 화면</span>
                </label>
              )}
            </li>
          ))}
        </ul>

        {/* 몇 번째인지. 화살표만 있으면 끝이 어디인지 모른다 */}
        {many && (
          <p
            data-shot-count
            className="absolute right-3 bottom-3 border border-edge-strong bg-paper px-2 py-1 font-typewriter text-[11px] text-ink-soft"
          >
            {shots.map((shot, index) => (
              <span key={shot.src}>
                {index + 1} / {shots.length}
              </span>
            ))}
          </p>
        )}
      </div>

      {/* 썸네일. 누르면 그 장으로 간다 */}
      {many && (
        <ul data-shot-thumbs className="flex flex-wrap gap-2">
          {shots.map((shot, index) => (
            <li key={shot.src}>
              <label htmlFor={id(index)} data-shot-thumb className="block cursor-pointer border">
                <Image
                  src={shot.src}
                  alt=""
                  width={shot.width}
                  height={shot.height}
                  className="h-14 w-auto"
                />
              </label>
            </li>
          ))}
        </ul>
      )}

      {/* 설명은 장마다 다르므로 목록으로 둔다 — 넘길 때 같이 따라오면 글이 튄다 */}
      {shots.some((shot) => shot.caption) && (
        <ol className="flex flex-col gap-1 font-typewriter text-[11px] text-faint">
          {shots.map((shot, index) =>
            shot.caption ? (
              <li key={shot.src}>
                {index + 1}. {shot.caption}
              </li>
            ) : null,
          )}
        </ol>
      )}
    </fieldset>
  );
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

      {/*
        **화면이 제목보다 먼저 온다.** 이 지면에 온 사람이 알고 싶은 것은 이름이 아니라
        "무엇을 만들었길래"이고, 그 답은 글자보다 그림이 빠르다. 제목은 바로 아래에서
        받는다 — 그림만 있고 이름이 없는 구간은 한 화면을 넘지 않는다.

        목록의 썸네일과 같은 `shots[0]`에서 시작하므로, 눌러서 들어온 사람이 보던 그림이
        그대로 커진다.
      */}
      {project.shots.length > 0 && (
        <div className="mt-8">
          <ProjectShots slug={project.slug} shots={project.shots} />
        </div>
      )}

      <header className="mt-8 flex flex-col gap-4">
        <p className="font-typewriter text-[11px] tracking-[0.12em] text-faint">{project.kind}</p>

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

      <section className="mt-10 flex flex-col gap-3 border-line border-t pt-7">
        <SectionLabel>개요</SectionLabel>
        {project.summary.map((paragraph) => (
          <p key={paragraph} className="max-w-measure text-[14px] leading-body text-ink-soft">
            {paragraph}
          </p>
        ))}
      </section>

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
