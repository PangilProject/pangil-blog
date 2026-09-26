import { access, mkdir, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

import sharp, { type OutputInfo } from "sharp";

/**
 * 작업물 스크린샷 굽기 — `npm run shots -- <slug> <원본...>`.
 *
 * ADR-005가 정한 상한을 **사람이 기억하지 않아도 되게** 한 곳에 박아 둔다:
 * webp · 긴 변 1400px · 건당 10장 · 장당 200KB. 규칙을 문서에만 두면 반드시 한 번 샌다 —
 * `lib/site/projectContent.test.ts`가 뒤에서 막고 있지만, 막히는 것보다 애초에 맞게
 * 나오는 쪽이 싸다.
 *
 * **긴 변을 보고 줄인다.** 폰 캡처는 세로가 길고 데스크톱 캡처는 가로가 길어서,
 * 폭만 맞추면 한쪽이 상한을 그냥 넘어간다.
 *
 * 마지막에 `projectContent.ts`에 붙여 넣을 `shots` 배열을 그대로 찍는다. 치수를 손으로
 * 옮기면 틀리고, 틀리면 그림이 도착할 때 지면이 튄다(`next/image`가 그 값으로 자리를 잡는다).
 *
 * ```bash
 * npm run shots -- checky ~/Desktop/캡처1.png ~/Desktop/캡처2.png
 * ```
 *
 * 같은 slug로 다시 돌리면 **01부터 덮어쓴다.** 순서를 바꾸고 싶으면 원본 순서를 바꿔
 * 통째로 다시 굽는다 — 중간에 한 장만 끼워 넣는 길은 두지 않는다. 번호와 순서가 어긋나기
 * 시작하면 목록 썸네일(`shots[0]`)이 대표가 아니게 된다.
 */

/** ADR-005 상한. `lib/site/projectContent.test.ts`의 숫자와 같아야 한다 */
const MAX_EDGE = 1400;
const MAX_SHOTS = 10;
const MAX_BYTES = 200 * 1024;

/** 넘칠 때 한 번 더 줄여 보는 품질. 여기서도 안 되면 사람이 자를 문제다 */
const QUALITY_STEPS = [82, 72, 62];

const [slug, ...sources] = process.argv.slice(2);

if (!slug || sources.length === 0) {
  console.error("쓰는 법: npm run shots -- <slug> <원본 파일...>");
  process.exit(1);
}

if (sources.length > MAX_SHOTS) {
  console.error(`한 작업물에 ${MAX_SHOTS}장까지다 (받은 것 ${sources.length}장, ADR-005).`);
  console.error("더 넣고 싶으면 상한과 캐러셀 CSS 규칙 수를 함께 올려야 한다.");
  process.exit(1);
}

// 없는 파일은 **굽기 전에** 걸러낸다. 한 장이라도 빠진 채로 절반만 구우면 번호가
// 밀려서 `shots[0]`이 대표가 아니게 되고, 그건 목록 썸네일까지 갈린다는 뜻이다
const missing: string[] = [];
for (const source of sources) {
  await access(source).catch(() => missing.push(source));
}

if (missing.length > 0) {
  console.error(`원본을 못 찾았습니다:\n${missing.map((file) => `  ${file}`).join("\n")}`);
  process.exit(1);
}

const dir = join("public", "projects", slug);
await mkdir(dir, { recursive: true });

/** 상한 안에 들 때까지 품질을 내린다. 못 들면 그대로 두고 시끄럽게 알린다 */
async function bake(source: string, out: string) {
  let last: OutputInfo | undefined;

  for (const quality of QUALITY_STEPS) {
    last = await sharp(source)
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toFile(out);

    if (last.size <= MAX_BYTES) return { ...last, quality };
  }

  return { ...(last as OutputInfo), quality: QUALITY_STEPS.at(-1) as number };
}

const lines: string[] = [];
let over = 0;

for (const [index, source] of sources.entries()) {
  const name = `${String(index + 1).padStart(2, "0")}.webp`;
  const out = join(dir, name);
  const { width, height, size, quality } = await bake(source, out);
  const kb = Math.round(size / 1024);

  if (size > MAX_BYTES) over += 1;

  console.log(
    `${over && size > MAX_BYTES ? "!" : "·"} ${basename(source)} → ${out}  ${width}×${height}  ${kb}KB  q=${quality}`,
  );

  lines.push(
    `      { src: "/projects/${slug}/${name}", alt: "", width: ${width}, height: ${height} },`,
  );
}

// 굽기 전에 있던 옛 장이 남아 있으면 지면과 파일이 어긋난다 — 지우진 않고 알리기만 한다
const left = (await readdir(dir)).filter((file) => {
  const order = Number.parseInt(file, 10);
  return file.endsWith(".webp") && order > sources.length;
});

console.log(`\n  projectContent.ts의 "${slug}" 항목에 붙여 넣으세요 — alt는 손으로 채웁니다:\n`);
console.log("    shots: [");
console.log(lines.join("\n"));
console.log("    ],\n");

if (left.length > 0) {
  console.log(`  전에 구운 파일이 남아 있습니다: ${left.join(", ")} — 안 쓸 것이면 지우세요.`);
}

if (over > 0) {
  console.error(`  ${over}장이 ${MAX_BYTES / 1024}KB를 넘습니다. 원본을 잘라서 다시 구우세요.`);
  process.exit(1);
}
