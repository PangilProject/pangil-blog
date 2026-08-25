import { readFile } from "node:fs/promises";

import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

import type { OgCard } from "@/lib/db/publicPosts";
import { ACCENT, CARD, EDGE, FAINT, INK, INK_SOFT, PAPER } from "@/lib/og/palette";
import { formatCallNumber } from "@/lib/record/callNumber";
import type { SiteKey } from "@/lib/site/resolveSite";

/**
 * OG 카드 그리기 (04 §3.5 · 03 §5.1) — 기록 카드를 1200×630으로 재조판한다.
 *
 * 목록 카드 = 상세 지면 = OG 카드가 같은 조판을 쓰는 것이 이 시스템의 축이다(04 §3.5).
 * 링크 공유가 곧 브랜딩이고, 썸네일을 지정하지 않은 글의 폴백도 이것이 겸한다.
 *
 * **`next/og`(ImageResponse)를 쓰지 않는다.** Node 24에서 래스터화 단계가 "Unsupported input"
 * 으로 터진다 — 폰트 없이 ASCII만 그려도 같고, next 16.3.2에서도 같다. satori는 정상이므로
 * satori(SVG) + resvg(PNG)를 직접 이어 붙인다. 두 단계가 분리돼 어느 쪽이 실패했는지도 분명하다.
 *
 * satori는 글자를 path로 굽는다. 그래서 래스터화 단계에는 폰트가 필요 없다.
 */

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * 카드는 630px 안에 다 들어와야 한다. 넘치면 푸터를 덮는다 — 실제로 그랬다.
 * satori의 line-clamp에 기대지 않고 글자 수로 자른다. 두 방식이 겹치면 어디서 잘렸는지 모른다.
 */
export function clamp(value: string, max: number): string {
  const text = value.trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** 제목이 길면 글자를 줄인다. 세 단계면 충분하다 */
export function titleFontSize(length: number): number {
  if (length <= 24) return 62;
  if (length <= 44) return 52;
  return 44;
}

const TITLE_MAX = 64;
const SUBTITLE_MAX = 76;

const SERIF = "RecordSerif";
const MONO = "RecordMono";

let fontsPromise: Promise<{ serif: Buffer; mono: Buffer }> | null = null;

function loadFonts() {
  // `new URL(..., import.meta.url)`은 번들 추적에 걸려 배포에도 파일이 함께 올라간다.
  // fetch로 읽으면 안 된다 — Node의 fetch는 file://을 지원하지 않아 500이 난다(실제로 그랬다)
  fontsPromise ??= Promise.all([
    readFile(new URL("./fonts/gowun-batang-700-ks.ttf", import.meta.url)),
    readFile(new URL("./fonts/nanum-gothic-coding-ascii.ttf", import.meta.url)),
  ]).then(([serif, mono]) => ({ serif, mono }));

  return fontsPromise;
}

export type OgFonts = { serif: Buffer; mono: Buffer };

/**
 * 카드 SVG. 폰트를 인자로 받는 이유는 **조판을 폰트 로딩과 떼어놓기** 위해서다 —
 * 테스트는 조판을 보고 싶은데, 번들 추적용 `import.meta.url` 경로는 테스트 런타임에서
 * file: 스킴이 아니다.
 */
export async function buildOgSvg(post: OgCard, { serif, mono }: OgFonts): Promise<string> {
  const accent = post.type === "TECH" ? ACCENT.dev : ACCENT.faith;
  const callNumber = formatCallNumber({
    type: post.type,
    callNumber: post.callNumber,
    categoryName: post.categoryName,
  });

  const title = clamp(post.title, TITLE_MAX);
  const subtitle = post.subtitle ? clamp(post.subtitle, SUBTITLE_MAX) : null;

  const svg = await satori(
    <div style={{ display: "flex", width: "100%", height: "100%", background: PAPER, padding: 56 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: CARD,
          border: `1px solid ${EDGE}`,
          borderTop: `6px solid ${accent}`,
          padding: "44px 60px 40px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: MONO,
            fontSize: 22,
            color: accent,
          }}
        >
          <span>{callNumber ?? ""}</span>
          <span style={{ color: FAINT }}>{post.publishedAt ?? ""}</span>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontFamily: SERIF,
            // 긴 제목은 줄여야 630px 안에 들어온다
            fontSize: titleFontSize(title.length),
            lineHeight: 1.35,
            color: INK,
          }}
        >
          {title}
        </div>

        {subtitle && (
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontFamily: SERIF,
              fontSize: 26,
              color: INK_SOFT,
            }}
          >
            {subtitle}
          </div>
        )}

        <div
          style={{
            display: "flex",
            marginTop: "auto",
            justifyContent: "space-between",
            fontFamily: MONO,
            fontSize: 20,
            color: FAINT,
          }}
        >
          <span>{post.siteLabel}</span>
          <span>{post.typeLabel}</span>
        </div>
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        // 총칭 이름(serif/mono)을 쓰면 satori의 폰트 해석과 충돌한다 — 고유 이름을 준다
        { name: SERIF, data: serif, style: "normal", weight: 700 },
        { name: MONO, data: mono, style: "normal", weight: 400 },
      ],
    },
  );

  return svg;
}

/** SVG를 PNG로. satori가 글자를 path로 구워 놓으므로 이 단계에는 폰트가 필요 없다 */
export function rasterize(svg: string): Buffer {
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng());
}

export async function renderOgCard(post: OgCard): Promise<Buffer> {
  return rasterize(await buildOgSvg(post, await loadFonts()));
}

/**
 * 글이 아닌 지면(목록·태그·허브)의 카드.
 *
 * 글 카드와 같은 종이·같은 괘를 쓴다 — 공유된 링크만 보고도 같은 곳임을 알아야 한다.
 * **장수 같은 DB 값을 넣지 않는다.** 허브 지면이 빌드에서 DB를 보지 않기로 한 것과 같은
 * 이유이고(01 §3.3), 숫자가 들어가는 순간 이 그림에도 무효화 규칙이 필요해진다.
 */
export type SiteOgCard = {
  site: SiteKey;
  /** 지면 표시명 — "믿음의 기록" */
  name: string;
  description: string | null;
  /** 지면 코드 H·F·D (02 화면 번호 체계). 글 카드의 청구기호 자리에 선다 */
  code: string;
  /** 카드 아래에 적는 주소. 도메인이 미확정이면 지금 서 있는 호스트다 */
  host: string;
};

export async function buildSiteOgSvg(card: SiteOgCard, { serif, mono }: OgFonts): Promise<string> {
  const accent = ACCENT[card.site];
  const title = clamp(card.name, TITLE_MAX);
  const description = card.description ? clamp(card.description, SUBTITLE_MAX) : null;

  return satori(
    <div style={{ display: "flex", width: "100%", height: "100%", background: PAPER, padding: 56 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: CARD,
          border: `1px solid ${EDGE}`,
          borderTop: `6px solid ${accent}`,
          padding: "44px 60px 40px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: MONO,
            fontSize: 22,
            color: accent,
          }}
        >
          <span>{card.code}</span>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontFamily: SERIF,
            fontSize: titleFontSize(title.length),
            lineHeight: 1.35,
            color: INK,
          }}
        >
          {title}
        </div>

        {description && (
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontFamily: SERIF,
              fontSize: 26,
              color: INK_SOFT,
            }}
          >
            {description}
          </div>
        )}

        <div
          style={{
            display: "flex",
            marginTop: "auto",
            fontFamily: MONO,
            fontSize: 20,
            color: FAINT,
          }}
        >
          <span>{card.host}</span>
        </div>
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: SERIF, data: serif, style: "normal", weight: 700 },
        { name: MONO, data: mono, style: "normal", weight: 400 },
      ],
    },
  );
}

export async function renderSiteOgCard(card: SiteOgCard): Promise<Buffer> {
  return rasterize(await buildSiteOgSvg(card, await loadFonts()));
}
