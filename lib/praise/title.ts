/**
 * 찬양 글 제목 자동 제안 (00 §7-4 · 02 §5.4).
 *
 * YouTube oEmbed의 `title`·`author_name`을 `아티스트 - 곡명`으로 정규화한다.
 *
 * **편향은 폴백 쪽이다.** 애매하면 손대지 않고 원본 제목을 그대로 준다. 이 기능의 값은
 * "대체로 맞아서 그냥 두는 것"이고, 반쯤 맞춘 제목은 매번 고쳐야 하므로 안 하는 것보다
 * 나쁘다. 제안일 뿐이고 제목 칸은 항상 편집 가능하다.
 *
 * 순수 함수다 — 네트워크는 Server Action이 담당한다(lib/actions/praise).
 */

export type OEmbedTitleInput = {
  title: string;
  authorName?: string | null;
};

/**
 * 채널명에 붙는 꼬리표. "Official"이 붙은 채널명을 아티스트로 쓰면 제목이 어색해진다.
 * 채널명 자체의 일부일 수 있는 단어(Ministry, Worship 등)는 건드리지 않는다.
 */
const CHANNEL_SUFFIXES = [
  "official",
  "officical",
  "channel",
  "tv",
  "공식채널",
  "공식",
  "채널",
] as const;

/**
 * 괄호 안이 이것들뿐이면 통째로 버린다.
 * Live·Acoustic·Cover처럼 찬양에서 의미가 있는 표기는 남긴다 — 같은 곡의 다른 기록이다.
 */
const NOISE_WORDS = [
  "official",
  "officical",
  "mv",
  "m/v",
  "music video",
  "video",
  "audio",
  "lyric",
  "lyrics",
  "lyric video",
  "가사",
  "가사영상",
  "공식",
  "공식영상",
  "4k",
  "fhd",
  "hd",
  "hq",
  "full ver",
  "full version",
];

/**
 * 아티스트 별칭. oEmbed의 채널명과 실제로 쓰는 이름이 다를 때만 넣는다.
 * 지금은 비어 있다 — 실사용에서 어긋나는 채널이 나올 때 한 줄씩 는다.
 * 미리 추측해 채우면 틀린 이름을 자동으로 붙이는 쪽이 된다.
 */
const ARTIST_ALIASES: Record<string, string> = {};

/** 구분자 — 아티스트와 곡명을 가르는 자리로 쓰인다 */
const SEPARATOR_PATTERN = /\s*[|ㅣ/·–—]\s*|\s+-\s+/;

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isNoise(value: string): boolean {
  const normalized = collapse(value)
    .toLowerCase()
    .replace(/[.\-_]/g, " ");
  if (normalized === "") return true;

  // "Official MV"처럼 잡음 단어만으로 이루어진 덩어리를 버린다
  return collapse(normalized)
    .split(" ")
    .every((word) => NOISE_WORDS.includes(word) || /^\d+(k|p)?$/.test(word));
}

/** 대괄호·괄호 덩어리 중 잡음만 든 것을 버린다 (00 §7-4 "대괄호·구분자 처리") */
function stripNoiseBrackets(title: string): string {
  return collapse(
    title.replace(/[[({【<]([^[\](){}【】<>]*)[\])}】>]/g, (whole, inner: string) =>
      isNoise(inner) ? " " : whole,
    ),
  );
}

/** 대괄호가 아티스트를 담는 관행: "[마커스워십] 주님의 시간에" */
function leadingBracketArtist(title: string): { artist: string; rest: string } | null {
  const match = /^[[【]([^[\]【】]+)[\]】]\s*(.+)$/.exec(title);
  if (!match) return null;

  const [, artist, rest] = match;
  if (!artist || !rest || isNoise(artist)) return null;

  return { artist: collapse(artist), rest: collapse(rest) };
}

export function normalizeArtist(authorName: string): string {
  let artist = collapse(authorName);

  // 꼬리표는 한 번만 떼면 "OO Official TV"가 남는다
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of CHANNEL_SUFFIXES) {
      const pattern = new RegExp(`[\\s\\-_·]*${suffix}\\s*$`, "i");
      if (pattern.test(artist)) {
        artist = collapse(artist.replace(pattern, ""));
        changed = true;
      }
    }
  }

  return ARTIST_ALIASES[artist] ?? artist;
}

function sameArtist(a: string, b: string): boolean {
  const key = (value: string) => value.toLowerCase().replace(/\s+/g, "");
  return key(a) === key(b);
}

/**
 * `아티스트 - 곡명` 제안. 확신이 없으면 원본 제목을 그대로 돌려준다.
 */
export function suggestPraiseTitle({ title, authorName }: OEmbedTitleInput): string {
  const original = collapse(title);
  if (original === "") return "";

  const artist = authorName ? normalizeArtist(authorName) : "";
  const bracketed = leadingBracketArtist(original);
  const cleaned = stripNoiseBrackets(bracketed ? bracketed.rest : original);

  // 이미 "아티스트 - 곡명" 꼴이면 손대지 않는다. 곡명에 하이픈이 있을 수 있어 앞 한 번만 자른다
  const parts = cleaned.split(SEPARATOR_PATTERN).map(collapse).filter(Boolean);
  const bracketArtist = bracketed?.artist;

  if (parts.length >= 2) {
    const [first, ...rest] = parts;
    const tail = rest.filter((part) => !isNoise(part));
    const song = tail.join(" - ");

    // "곡명 | 아티스트" 순서도 흔하다 — 채널명과 같은 쪽을 아티스트로 본다
    if (artist && first && sameArtist(first, artist)) {
      return song ? `${artist} - ${song}` : original;
    }
    if (artist && tail.length === 1 && tail[0] && sameArtist(tail[0], artist)) {
      return `${artist} - ${first}`;
    }
    if (first && song) return `${first} - ${song}`;
  }

  const song = cleaned;
  const leadArtist = bracketArtist ?? artist;

  // 아티스트를 모르면 정규화할 근거가 없다 — 정리된 제목까지만 준다
  if (!leadArtist) return song || original;
  if (song === "" || sameArtist(song, leadArtist)) return original;

  return `${leadArtist} - ${song}`;
}
