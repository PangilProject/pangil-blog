import "server-only";

import { gzipSync } from "node:zlib";

/**
 * 백업 파일 저장 (06 §8 · 미결 #4 해소 — Supabase Storage에 둔다).
 *
 * GitHub 레포에 커밋하는 방법도 있지만, 그러려면 Actions에 DB 자격증명을 줘야 한다.
 * 크롤러 워크플로우가 털려도 초안 하나가 끝이라는 성질(06 §1.1)을 백업 때문에 깨지 않는다.
 * 앱은 이미 DB와 Storage 둘 다에 정당한 접근권이 있으므로, 백업은 앱에서 나가는 게 맞다.
 *
 * **버킷은 비공개다.** 글 전문과 초안이 들어 있으니 post-images와 같은 취급을 할 수 없다.
 * 없으면 만든다 — 손으로 만들어야 하는 준비물을 늘리면 잊는다.
 */

const BUCKET = "backups";
const PREFIX = "db/";

function storageEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다 (.env.example 참조).",
    );
  }

  return { url, key };
}

async function createPrivateBucket(url: string, key: string) {
  const response = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  });

  // 이미 있으면(409) 그것도 성공이다 — 동시에 두 번 돌았을 수 있다
  if (!response.ok && response.status !== 409) {
    throw new Error(
      `백업 버킷 생성 실패: ${response.status} ${(await response.text()).slice(0, 200)}`,
    );
  }
}

/** `bytes`는 **압축 후** 크기다 — 실제로 자리를 차지하는 값이라 그것을 알린다 */
export type BackupUpload = { path: string; bytes: number };

/**
 * 버킷이 없다는 응답인가.
 *
 * **상태 코드로 판단하면 안 된다.** Supabase Storage는 이걸 `400`으로 주고 본문에만
 * `{"statusCode":"404","error":"Bucket not found"}`를 담는다 — 404를 기다리던 첫 구현이
 * 첫 백업에서 그대로 실패했다.
 */
function isMissingBucket(status: number, body: string): boolean {
  if (status !== 400 && status !== 404) return false;
  return body.includes("Bucket not found") || body.includes("NoSuchBucket");
}

/**
 * 백업은 두 종류다 (2026-10 Egress 회차).
 *
 * - **전체(full)** `2026-10-18.json.gz` — 블로그 전문 한 벌. 일요일마다, 그리고 손으로 부를 때.
 * - **변경분(delta)** `2026-10-19.delta.json.gz` — 마지막 전체 이후 바뀐 글과 작은 테이블.
 *
 * 매일 전체를 뜨면 글 전문(약 17MB)을 매일 DB 밖으로 읽어 나간다 — 한 달 약 0.5GB로 무료
 * Egress 5GB의 10%였다. 크롤러가 매일 QT 초안을 만들어서 "바뀐 게 없으면 건너뛴다"는 통하지
 * 않았다(2주 동안 안 바뀐 날이 하루도 없었다). 그래서 매일은 바뀐 것만 담는다.
 *
 * **변경분은 누적이다.** 기준 전체 이후의 변경을 매번 다 담으므로, 복원에는 전체 한 장과
 * 그 뒤 **가장 최근 변경분 한 장**만 있으면 된다 — 사이의 변경분을 차례로 덧댈 필요가 없다.
 */
export type BackupKind = "full" | "delta";

const DELTA_SUFFIX = ".delta.json.gz";

export function backupFileName(dateKey: string, kind: BackupKind): string {
  return kind === "delta" ? `${dateKey}${DELTA_SUFFIX}` : `${dateKey}.json.gz`;
}

export function isDeltaBackup(name: string): boolean {
  return name.endsWith(DELTA_SUFFIX);
}

/** 이름이 날짜로 시작한다 — `2026-10-18.json.gz` → `2026-10-18` */
function dateKeyOf(name: string): string {
  return name.slice(0, 10);
}

/** 전체 백업 하나가 너무 낡았다고 볼 날 수. 일요일 전체가 실패해도 이보다 오래 끌지 않는다 */
const FULL_MAX_AGE_DAYS = 7;

const DAY_MS = 86_400_000;

export type BackupPlan =
  | { kind: "full" }
  | {
      kind: "delta";
      /** 기준 전체 백업의 날짜 */
      base: string;
      /** 이 시각 이후 바뀐 글을 담는다 — 기준 날의 KST 0시. 겹쳐 담는 쪽으로 넉넉하다 */
      since: Date;
    };

/**
 * 오늘 무엇을 뜰지 정한다. 의심스러우면 **전체**다 — 변경분은 기준이 확실할 때만.
 *
 * @param names 저장된 백업 이름, 최신순(`listBackupNames`)
 */
export function planBackup(input: {
  dateKey: string;
  sunday: boolean;
  names: string[];
  force?: boolean;
}): BackupPlan {
  if (input.force || input.sunday) return { kind: "full" };

  const latestFull = input.names.find((name) => !isDeltaBackup(name));
  if (!latestFull) return { kind: "full" };

  const base = dateKeyOf(latestFull);
  // 오늘 이미 전체가 있으면(손으로 뜬 날) 같은 날짜의 변경분을 따로 만들지 않고 전체를 다시 뜬다
  if (base >= input.dateKey) return { kind: "full" };

  const ageDays = (Date.parse(input.dateKey) - Date.parse(base)) / DAY_MS;
  if (!(ageDays < FULL_MAX_AGE_DAYS)) return { kind: "full" };

  return { kind: "delta", base, since: new Date(`${base}T00:00:00+09:00`) };
}

/**
 * `backups/db/2026-08-24.json.gz` — 같은 날 두 번 돌면 덮어쓴다(하루 한 장).
 *
 * **gzip으로 담는다.** 백업은 글자뿐이고 JSON은 키 이름과 구조가 끝없이 되풀이돼서 압축이
 * 아주 잘 듣는다 — 실측 **23.02MB → 3.78MB(16.4%)**. 잃는 것은 없고 장수도 줄이지 않는다.
 *
 * **푸는 데 이 레포가 필요하지 않다.** 읽는 코드는 어디에도 없고 복원은 대시보드에서 손으로
 * 내려받는 일이다 — 받은 자리에서 `gunzip 2026-08-24.json.gz` 한 줄이면 원래 JSON이 된다.
 * 압축을 앱이 풀어야 했다면 이 결정은 훨씬 비쌌을 것이다.
 */
export async function uploadBackup(
  dateKey: string,
  body: string,
  kind: BackupKind = "full",
): Promise<BackupUpload> {
  const { url, key } = storageEnv();
  const path = `${BUCKET}/${PREFIX}${backupFileName(dateKey, kind)}`;
  // 하루 한 번 도는 일이라 시간보다 크기가 낫다 — 최고 압축을 쓴다
  const bytes = gzipSync(body, { level: 9 });

  const put = () =>
    fetch(`${url}/storage/v1/object/${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/gzip",
        "x-upsert": "true",
      },
      body: bytes,
    });

  let response = await put();
  let detail = response.ok ? "" : await response.text();

  if (isMissingBucket(response.status, detail)) {
    // 첫 백업이다. 버킷을 만들고 한 번만 다시 시도한다
    await createPrivateBucket(url, key);
    response = await put();
    detail = response.ok ? "" : await response.text();
  }

  if (!response.ok) {
    throw new Error(`백업 업로드 실패: ${response.status} ${detail.slice(0, 200)}`);
  }

  return { path, bytes: bytes.byteLength };
}

/**
 * 남겨 둘 장수. **일주일치다.**
 *
 * 되돌릴 일이 생기면 그건 "어제 글이 이상해졌다"이지 "반년 전으로 가고 싶다"가 아니다.
 * 한 장이 곧 블로그 전문 한 벌(글 1111편 · 23MB)이라 장수가 그대로 용량이다 — 지우는
 * 코드가 없던 동안 27장 601MB가 쌓였고, 그게 Supabase 무료 1GB를 넘긴 원인의 절반이었다.
 *
 * 변경분이 섞인 뒤로는 **남긴 변경분이 기대는 전체도 함께 남긴다**(`staleBackups`).
 * 그게 없으면 변경분은 읽을 수 없는 조각이다.
 */
export const KEEP_BACKUPS = 7;

/** `db/2026-09-19.json` — 이름이 곧 날짜라 사전순이 날짜순이다 */
type StoredObject = { name: string };

/** 저장된 백업 이름, 최신순. 오늘 무엇을 뜰지(`planBackup`) 정할 때 쓴다 */
export async function listBackupNames(): Promise<string[]> {
  const { url, key } = storageEnv();
  return listBackups(url, key);
}

/**
 * 지울 이름을 고른다. 최신 `keep`장을 남기고, **남는 변경분이 기대는 전체**는 장수 밖이어도 남긴다.
 *
 * 변경분의 기준은 이름 순서로 정해진다 — 그보다 오래된 쪽에서 처음 만나는 전체다
 * (`planBackup`이 늘 가장 최근 전체를 기준으로 삼기 때문이다).
 */
export function staleBackups(names: string[], keep = KEEP_BACKUPS): string[] {
  const kept = new Set(names.slice(0, keep));

  names.forEach((name, index) => {
    if (!kept.has(name) || !isDeltaBackup(name)) return;
    const base = names.slice(index + 1).find((older) => !isDeltaBackup(older));
    if (base) kept.add(base);
  });

  return names.filter((name) => !kept.has(name));
}

async function listBackups(url: string, key: string): Promise<string[]> {
  const response = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    // 장수가 KEEP_BACKUPS 언저리라 한 번에 다 온다. 넉넉히 불러 두고 넘치면 지운다
    body: JSON.stringify({
      prefix: PREFIX,
      limit: 1000,
      sortBy: { column: "name", order: "desc" },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `백업 목록 조회 실패: ${response.status} ${(await response.text()).slice(0, 200)}`,
    );
  }

  const rows = (await response.json()) as StoredObject[];
  /*
    폴더 자리 표시자가 섞여 오는 일이 있다 — 날짜 파일만 센다.

    **`.json`도 함께 받는 것은 압축 이전에 쌓인 27장 때문이다.** 확장자만 보고 새것만 세면
    옛 파일이 정리 대상에서 빠져 영원히 남는다. 이름이 날짜로 시작하므로 둘이 섞여 있어도
    사전순이 곧 날짜순이라는 성질은 그대로다.
  */
  return rows
    .map((row) => row.name)
    .filter((name) => name.endsWith(".json") || name.endsWith(".json.gz"));
}

export type BackupPrune = { deleted: string[] };

/**
 * 일주일치만 남기고 옛 백업을 지운다.
 *
 * **백업을 올린 직후에 부른다.** 따로 크론을 두지 않는 이유는 Hobby의 크론 두 자리가 이미
 * 찼기 때문이고(06 §8), 무엇보다 "새로 한 장 생겼으니 옛것 한 장 버린다"가 자연스럽다.
 *
 * 여기서 던지는 것은 **백업 자체의 실패가 아니다.** 부르는 쪽이 그렇게 다뤄야 한다 —
 * 정리에 실패해도 오늘 백업은 이미 올라가 있다(`lib/cron/tasks.ts`).
 */
export async function pruneBackups(keep = KEEP_BACKUPS): Promise<BackupPrune> {
  const { url, key } = storageEnv();

  const names = await listBackups(url, key);
  // 이름 내림차순이므로 앞쪽이 최신이다. 뒤에 남는 것이 버릴 것 — 단, 변경분의 기준은 남긴다
  const stale = staleBackups(names, keep);

  if (stale.length === 0) return { deleted: [] };

  const response = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ prefixes: stale.map((name) => `${PREFIX}${name}`) }),
  });

  if (!response.ok) {
    throw new Error(
      `옛 백업 삭제 실패: ${response.status} ${(await response.text()).slice(0, 200)}`,
    );
  }

  return { deleted: stale };
}
