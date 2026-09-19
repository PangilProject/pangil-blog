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
 * `backups/db/2026-08-24.json.gz` — 같은 날 두 번 돌면 덮어쓴다(하루 한 장).
 *
 * **gzip으로 담는다.** 백업은 글자뿐이고 JSON은 키 이름과 구조가 끝없이 되풀이돼서 압축이
 * 아주 잘 듣는다 — 실측 **23.02MB → 3.78MB(16.4%)**. 잃는 것은 없고 장수도 줄이지 않는다.
 *
 * **푸는 데 이 레포가 필요하지 않다.** 읽는 코드는 어디에도 없고 복원은 대시보드에서 손으로
 * 내려받는 일이다 — 받은 자리에서 `gunzip 2026-08-24.json.gz` 한 줄이면 원래 JSON이 된다.
 * 압축을 앱이 풀어야 했다면 이 결정은 훨씬 비쌌을 것이다.
 */
export async function uploadBackup(dateKey: string, body: string): Promise<BackupUpload> {
  const { url, key } = storageEnv();
  const path = `${BUCKET}/${PREFIX}${dateKey}.json.gz`;
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
 */
export const KEEP_BACKUPS = 7;

/** `db/2026-09-19.json` — 이름이 곧 날짜라 사전순이 날짜순이다 */
type StoredObject = { name: string };

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
  // 이름 내림차순이므로 앞쪽이 최신이다. 뒤에 남는 것이 버릴 것
  const stale = names.slice(keep);

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
