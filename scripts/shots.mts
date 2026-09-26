import { access, mkdir, readdir, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

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
 * npm run shots -- checky ~/Desktop/캡처1.png ~/Desktop/캡처2.png   # 파일을 늘어놓거나
 * npm run shots -- re-log ./public/projects/re-log                  # 폴더 하나만 줘도 된다
 * ```
 *
 * **폴더를 주면 그 안의 그림을 이름순으로 굽는다.** 이름순이라 원본을 `1. 홈.png`,
 * `2. 목록.png`처럼 번호로 시작하게 두면 그 순서가 그대로 장 순서가 된다. 숫자는
 * 자릿수가 아니라 값으로 센다(`2`가 `10`보다 앞이다).
 *
 * 굽고 나온 `01.webp`~`NN.webp`는 **원본 목록에서 빼므로**, 출력 폴더를 그대로 입력으로
 * 줘도 자기가 구운 것을 다시 굽지 않는다.
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

/** sharp가 읽는 것 중 캡처로 들어올 만한 것만. 폴더를 훑을 때 쓴다 */
const IMAGE = /\.(png|jpe?g|webp|avif|tiff?|gif)$/i;

/** 이 스크립트가 구워 낸 파일. 출력 폴더를 입력으로 줘도 자기 것을 다시 굽지 않게 */
const BAKED = /^\d{2}\.webp$/;

const [slug, ...given] = process.argv.slice(2);

if (!slug || given.length === 0) {
  console.error("쓰는 법: npm run shots -- <slug> <원본 파일...|폴더>");
  process.exit(1);
}

/** 폴더면 안의 그림을 이름순으로 편다. 파일이면 그대로 둔다 */
async function expand(entry: string): Promise<string[]> {
  const info = await stat(entry).catch(() => null);

  if (!info) return [entry]; // 없는 것은 아래 검사에서 잡는다

  if (!info.isDirectory()) return [entry];

  // 굽기 전 원본은 `origin/`에 둔다(ADR-005). 출력 폴더를 줬는데 그 안에 있으면
  // 그쪽을 원본으로 본다 — `npm run shots -- checky ./public/projects/checky` 한 줄이
  // 다시 굽기가 된다
  const origin = join(entry, "origin");
  if (
    await stat(origin).then(
      (o) => o.isDirectory(),
      () => false,
    )
  )
    return expand(origin);

  const files = (await readdir(entry))
    .filter((file) => !file.startsWith(".") && IMAGE.test(file) && !BAKED.test(file))
    // 숫자를 값으로 센다 — 사전순이면 `10.`이 `2.`보다 앞에 온다
    .sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));

  if (files.length === 0) {
    console.error(`${entry} 안에 구울 그림이 없습니다.`);
    console.error("이미 구워 둔 01.webp 같은 파일은 원본으로 세지 않습니다.");
    process.exit(1);
  }

  return files.map((file) => join(entry, file));
}

const sources = (await Promise.all(given.map(expand))).flat();

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

// 원본이 출력 폴더 안에 있으면 그것도 `public/`이라 **그대로 서빙된다.** 굽는 의미가
// 없어지고, `projectContent.test.ts`의 "webp만 둔다"가 막는다. 지우는 것은 사람이 한다 —
// 이 폴더에 둔 것이 유일한 원본일 수도 있다
const inside = sources.filter((source) => resolve(source).startsWith(resolve(dir)));

if (inside.length > 0) {
  console.log(`\n  원본 ${inside.length}장이 ${dir} 안에 남아 있습니다.`);
  console.log("  거기 두면 원본도 함께 서빙됩니다 — 레포 밖으로 옮기거나 지우세요.");
}

if (over > 0) {
  console.error(`  ${over}장이 ${MAX_BYTES / 1024}KB를 넘습니다. 원본을 잘라서 다시 구우세요.`);
  process.exit(1);
}
