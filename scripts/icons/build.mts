import { mkdir, writeFile } from "node:fs/promises";

import { Resvg } from "@resvg/resvg-js";

import { buildMarkSvg } from "@/lib/og/mark";
import { SITE_KEYS, type SiteKey } from "@/lib/site/resolveSite";

/**
 * 아이콘 굽기 — `npm run icons`.
 *
 * 결과물은 **커밋한다.** 런타임에 그리지 않는 이유는 파비콘이 요청당 satori를 돌릴 만한
 * 물건이 아니기 때문이고, 빌드에서 그리지 않는 이유는 배포 산출물이 조용히 달라지는 것을
 * 원하지 않기 때문이다(프리모템 #6). 마크를 고치면 이 스크립트를 다시 돌려 diff를 남긴다.
 *
 * 지면마다 액센트만 다른 같은 마크다. Next는 세그먼트별 아이콘 파일을 알아보므로
 * `app/(public)/dev/icon.svg`가 dev 지면에서 루트 아이콘을 덮는다.
 */
const root = new URL("../../", import.meta.url);

/** 지면별 아이콘이 놓일 세그먼트. 허브는 루트가 겸한다(루트 도메인이 곧 허브다) */
const SEGMENT: Record<SiteKey, string> = {
  hub: "app/",
  dev: "app/(public)/dev/",
  faith: "app/(public)/faith/",
};

const APPLE_SIZE = 180;
const MANIFEST_SIZES = [192, 512];
const FAVICON_SIZE = 32;

function png(svg: string, size: number): Buffer {
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng());
}

/**
 * PNG를 ICO 껍데기에 넣는다. ICO는 PNG를 그대로 담을 수 있어서(Vista 이후) 인코더가 필요 없다 —
 * 6바이트 헤더 + 16바이트 엔트리 + PNG다. 이걸 위해 의존성을 늘리지 않는다.
 */
function ico(pngData: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0); // width
  entry.writeUInt8(size, 1); // height
  entry.writeUInt8(0, 2); // 팔레트 없음
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngData.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, pngData]);
}

async function write(path: string, data: string | Buffer) {
  const target = new URL(path, root);
  await mkdir(new URL("./", target), { recursive: true });
  await writeFile(target, data);
  console.log(`[icons] ${path}`);
}

await mkdir(new URL("public/icons/", root), { recursive: true });

for (const site of SITE_KEYS) {
  const svg = buildMarkSvg(site);

  await write(`${SEGMENT[site]}icon.svg`, svg);
  await write(`${SEGMENT[site]}apple-icon.png`, png(svg, APPLE_SIZE));

  // manifest는 라우트 핸들러가 호스트를 보고 고르므로 세 벌을 미리 굽는다
  for (const size of MANIFEST_SIZES) {
    await write(`public/icons/${site}-${size}.png`, png(svg, size));
  }
}

// 파비콘은 루트 한 장이다. 브라우저가 /favicon.ico를 지면과 무관하게 찾아온다
await write("app/favicon.ico", ico(png(buildMarkSvg("hub"), FAVICON_SIZE), FAVICON_SIZE));
