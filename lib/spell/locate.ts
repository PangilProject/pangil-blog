/**
 * 맞춤법 검사 결과를 글자 위치로 바꾼다.
 *
 * 다음 검사기는 **위치를 주지 않는다** — 틀린 말(token)과 그 앞뒤 몇 어절(context)만 준다.
 * 그래서 우리가 원문에서 찾아야 하는데, "되서"가 한 글에 두 번 나오면 token만으로는 어느
 * 쪽인지 모른다. context로 먼저 좁히고, 이미 차지한 자리는 다시 쓰지 않는다.
 *
 * **결과의 순서를 믿지 않는다.** hanspell은 긴 글을 잘라 시차를 두고 보내는데, 응답이 보낸
 * 순서대로 온다는 보장이 없다. 그래서 앞에서부터 커서를 미는 방식이 아니라, 결과마다 원문
 * 전체에서 "아직 아무도 차지하지 않은 가장 앞자리"를 찾는다.
 */

/** 검사기가 돌려준 오류 하나. 검사기마다 다른 모양을 이 형태로 좁힌다(lib/spell/daum) */
export type SpellTypo = {
  /** 검사기의 분류 그대로다. 다음: spell · space · space_spell · doubt … */
  type: string;
  token: string;
  suggestion: string;
  context: string;
  info: string | null;
};

/** 위치를 찾은 오류. from·to는 검사를 보낸 글자열(segment) 안의 위치다 */
export type LocatedTypo = Omit<SpellTypo, "context"> & {
  segment: number;
  from: number;
  to: number;
};

/** 다음 검사기가 한 번에 받는 글자 수 (hanspell의 DAUM_MAX_CHARS) */
export const CHUNK_MAX_CHARS = 1000;

type Range = { from: number; to: number };

/** 한 덩어리 글 안에서 오류들의 자리를 찾는다. 못 찾은 것은 버린다 — 엉뚱한 자리에 긋느니 안 긋는다 */
export function locateTypos(text: string, typos: SpellTypo[]): (SpellTypo & Range)[] {
  const claimed: Range[] = [];
  const isFree = (from: number, to: number) =>
    claimed.every((range) => to <= range.from || range.to <= from);

  const located: (SpellTypo & Range)[] = [];

  for (const typo of typos) {
    if (typo.token.length === 0) continue;

    const from = findFree(text, typo, isFree);
    if (from === -1) continue;

    const to = from + typo.token.length;
    claimed.push({ from, to });
    located.push({ ...typo, from, to });
  }

  return located.sort((a, b) => a.from - b.from);
}

function findFree(
  text: string,
  { token, context }: SpellTypo,
  isFree: (from: number, to: number) => boolean,
): number {
  // context 안의 token을 먼저 본다. 같은 말이 여러 번 나와도 앞뒤 어절이 자리를 가른다
  if (context.includes(token)) {
    for (let at = text.indexOf(context); at !== -1; at = text.indexOf(context, at + 1)) {
      const end = at + context.length;
      for (let hit = text.indexOf(token, at); hit !== -1 && hit + token.length <= end; ) {
        if (isFree(hit, hit + token.length)) return hit;
        hit = text.indexOf(token, hit + 1);
      }
    }
  }

  // context가 원문과 어긋나면(검사기가 공백을 정리했다든가) token만으로 찾는다
  for (let hit = text.indexOf(token); hit !== -1; hit = text.indexOf(token, hit + 1)) {
    if (isFree(hit, hit + token.length)) return hit;
  }

  return -1;
}

export type Chunk = {
  /** 이 덩어리에 들어간 segment 번호들 */
  segments: number[];
  /** 각 segment가 덩어리 글자열 안에서 시작하는 자리 */
  offsets: number[];
  lengths: number[];
  text: string;
};

/**
 * 짧은 글자열(문단)을 한도 안에서 이어 붙여 요청 수를 줄인다. 문단 하나에 한 번씩 보내면
 * 큐티 한 편이 스무 번 넘게 나간다. 이음매는 줄바꿈이다 — 검사기가 문장 경계로 본다.
 *
 * 한도를 넘는 문단은 혼자 한 덩어리가 된다. 그 안은 hanspell이 다시 자른다.
 */
export function chunkSegments(texts: string[], max = CHUNK_MAX_CHARS): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Chunk | null = null;

  texts.forEach((text, index) => {
    if (current && current.text.length + 1 + text.length <= max) {
      current.offsets.push(current.text.length + 1);
      current.lengths.push(text.length);
      current.segments.push(index);
      current.text += `\n${text}`;
      return;
    }
    current = { segments: [index], offsets: [0], lengths: [text.length], text };
    chunks.push(current);
  });

  return chunks;
}

/** 덩어리 안의 자리를 segment 안의 자리로 돌린다. 이음매를 걸친 것은 버린다 */
export function toSegmentTypos(chunk: Chunk, located: (SpellTypo & Range)[]): LocatedTypo[] {
  const result: LocatedTypo[] = [];

  for (const { context: _context, from, to, ...typo } of located) {
    const k = chunk.offsets.findIndex(
      (start, i) => start <= from && to <= start + chunk.lengths[i],
    );
    if (k === -1) continue;

    const start = chunk.offsets[k];
    result.push({ ...typo, segment: chunk.segments[k], from: from - start, to: to - start });
  }

  return result;
}

/** 정해진 시간 안에 다 보지 못했다. 반쪽 결과는 "나머지는 다 맞다"로 읽히므로 통째로 실패다 */
export class SpellDeadlineError extends Error {
  constructor() {
    super("spell check deadline exceeded");
    this.name = "SpellDeadlineError";
  }
}

export type CheckOptions = {
  /** 동시에 보내는 덩어리 수. 남의 무료 서비스라 몰아 보내지 않는다 */
  concurrency?: number;
  /** 전체 검사가 이 시간을 넘기면 멈춘다(ms). 서버 함수가 중간에 잘리는 것보다 먼저 끝나야 한다 */
  deadlineMs?: number;
  /** 요청 하나의 상한(ms). 남은 시간이 더 짧으면 그만큼만 기다린다 */
  requestTimeoutMs?: number;
  now?: () => number;
};

/**
 * 글자열들을 검사한다. 검사기는 주입받는다 — 이 함수는 덩어리 짓기·자리 찾기·시간 관리만 안다.
 *
 * 덩어리는 **몇 개씩만 동시에** 보낸다. 하나씩 차례로 보내던 때는 2만 자에 요청 스무 번이
 * 줄을 서서, 서버 함수 시간 제한에 걸리면 이유도 없이 "검사하지 못했어요"가 됐다.
 */
export async function checkSegments(
  texts: string[],
  check: (text: string, timeoutMs: number) => Promise<SpellTypo[]>,
  {
    concurrency = 3,
    deadlineMs = Number.POSITIVE_INFINITY,
    requestTimeoutMs = 8000,
    now = Date.now,
  }: CheckOptions = {},
): Promise<LocatedTypo[]> {
  const chunks = chunkSegments(texts);
  const results: LocatedTypo[][] = [];
  const startedAt = now();
  let next = 0;

  const worker = async () => {
    while (next < chunks.length) {
      const index = next;
      next += 1;

      const remaining = deadlineMs - (now() - startedAt);
      if (remaining <= 0) throw new SpellDeadlineError();

      const chunk = chunks[index];
      const typos = await check(chunk.text, Math.min(requestTimeoutMs, remaining));
      results[index] = toSegmentTypos(chunk, locateTypos(chunk.text, typos));
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, worker));

  // 덩어리가 끝난 순서와 무관하게 문서 순서로 돌려준다
  return results.flat();
}
