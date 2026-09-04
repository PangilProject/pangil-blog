import Link from "next/link";

import { PostAdminControls } from "@/components/public/PostAdminControls";
import { PraiseView } from "@/components/public/PraiseView";
import { QtView } from "@/components/public/QtView";
import { RecordSheet } from "@/components/public/RecordSheet";
import { SermonView } from "@/components/public/SermonView";
import { TechView } from "@/components/public/TechView";
import type { PublicPost } from "@/lib/db/publicPosts";
import { tiptapToPlainText } from "@/lib/render/plainText";

/**
 * 상세 지면 조립 (F-03 / D-02).
 *
 * **렌더링 전 검증의 처리 지점이다**(04 §2.4 3중 검증의 세 번째). content가 스키마를 통과하지
 * 못하면 500을 내지 않고 **원문 폴백**을 그린다 — 스키마를 고치는 동안에도 그 글은 읽혀야 한다.
 * 알림(Slack)은 M4에서 붙는다.
 */
export function PostDetail({ post }: { post: PublicPost }) {
  const publishedAt = post.publishedAt
    ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(
        post.publishedAt,
      )
    : null;

  return (
    <RecordSheet
      postId={post.id}
      type={post.type}
      callNumber={post.callNumber}
      publishedAt={publishedAt}
      title={post.title}
      subtitle={
        // 제목 아래 줄: 왼쪽은 분류, 오른쪽은 관리 컨트롤(A-03b).
        // faith는 이 자리에 분류가 없다(카테고리는 TECH 전용) — 그래도 줄은 놓는다
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          {post.categoryName ? (
            <p className="font-typewriter text-[11px] text-faint">{post.categoryName}</p>
          ) : (
            <span />
          )}

          <PostAdminControls
            slug={post.slug}
            postId={post.id}
            title={post.title}
            listPath={post.type === "TECH" ? "/dev" : "/faith"}
          />
        </div>
      }
      meta={
        post.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <li key={tag}>
                {/* 태그 목록 지면은 슬라이스 3에서 생긴다 */}
                <Link
                  href={`/${post.type === "TECH" ? "dev" : "faith"}/tags/${encodeURIComponent(tag)}`}
                  className="border border-edge px-2 py-0.5 font-typewriter text-[10.5px] text-faint hover:text-ink"
                >
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        ) : null
      }
    >
      <PostBody post={post} />
    </RecordSheet>
  );
}

function PostBody({ post }: { post: PublicPost }) {
  if (!post.content.ok) {
    // 서버 로그에 남긴다 — 조용히 폴백하면 스키마 사고를 모르고 지난다
    console.error(`[render] content 스키마 실패 (${post.id}):`, post.content.issues.join(" / "));
    return <RawFallback raw={post.content.raw} />;
  }

  const content = post.content.content;

  switch (content.kind) {
    case "QT":
      return <QtView content={content} />;
    case "SERMON":
      return <SermonView content={content} />;
    case "PRAISE":
      return <PraiseView content={content} title={post.title} />;
    case "TECH":
      return <TechView content={content} />;
  }
}

/**
 * 원문 폴백. 구조를 모르는 채로 글자만 건져 문단으로 흘린다 —
 * 조판을 잃는 것과 글이 안 열리는 것은 급이 다르다.
 */
function RawFallback({ raw }: { raw: unknown }) {
  const text = collectText(raw);

  return (
    <div className="record-prose">
      <p className="font-typewriter text-[11px] text-(--accent)">
        이 글은 서식을 불러오지 못했어요. 내용은 그대로 보여드려요.
      </p>
      {text.map((paragraph, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 폴백 원문에는 안정적인 키가 없다
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}

function collectText(raw: unknown): string[] {
  if (typeof raw === "string") return [raw];
  if (raw === null || typeof raw !== "object") return [];

  // Tiptap 문서로 보이는 값은 평문 추출기를 재사용한다
  const candidate = raw as { type?: unknown; content?: unknown };
  if (candidate.type === "doc") {
    const text = tiptapToPlainText(raw as never);
    return text === "" ? [] : [text];
  }

  return Object.values(raw as Record<string, unknown>).flatMap(collectText);
}
