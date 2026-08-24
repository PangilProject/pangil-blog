import "server-only";

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

/** `backups/db/2026-08-24.json` — 같은 날 두 번 돌면 덮어쓴다(하루 한 장) */
export async function uploadBackup(dateKey: string, body: string): Promise<BackupUpload> {
  const { url, key } = storageEnv();
  const path = `${BUCKET}/db/${dateKey}.json`;
  const bytes = new TextEncoder().encode(body);

  const put = () =>
    fetch(`${url}/storage/v1/object/${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
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
