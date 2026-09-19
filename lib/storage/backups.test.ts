import { gunzipSync } from "node:zlib";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KEEP_BACKUPS, pruneBackups, uploadBackup } from "@/lib/storage/backups";

/**
 * 첫 백업에서 버킷을 만드는 경로 (06 §8).
 *
 * 이 테스트가 있는 이유: 첫 구현은 "버킷 없음"을 HTTP 404로 기다렸는데 Supabase는
 * **400 + 본문에 404**로 준다. 실제 첫 실행이 그래서 실패했다. 상태 코드로 판단하지
 * 않는다는 규칙을 여기서 고정한다.
 */

const BUCKET_MISSING = JSON.stringify({
  statusCode: "404",
  error: "Bucket not found",
  message: "Bucket not found",
  code: "NoSuchBucket",
});

function response(status: number, body = "") {
  return new Response(body, { status });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(...responses: Response[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(responses[calls.length - 1] ?? response(500));
  });

  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

describe("uploadBackup", () => {
  it("버킷이 있으면 한 번에 올린다", async () => {
    const calls = stubFetch(response(200));

    const result = await uploadBackup("2026-08-24", '{"posts":[]}');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://example.supabase.co/storage/v1/object/backups/db/2026-08-24.json.gz",
    );
    expect(result.path).toBe("backups/db/2026-08-24.json.gz");
  });

  it("400 본문의 'Bucket not found'를 보고 비공개 버킷을 만든 뒤 다시 올린다", async () => {
    const calls = stubFetch(response(400, BUCKET_MISSING), response(200), response(200));

    const result = await uploadBackup("2026-08-24", '{"posts":[]}');

    expect(calls).toHaveLength(3);
    expect(calls[1].url).toBe("https://example.supabase.co/storage/v1/bucket");
    expect(JSON.parse(String(calls[1].init.body))).toMatchObject({
      name: "backups",
      public: false,
    });
    expect(result.path).toBe("backups/db/2026-08-24.json.gz");
  });

  it("다른 실패는 버킷을 만들지 않고 그대로 던진다", async () => {
    const calls = stubFetch(response(403, "forbidden"));

    await expect(uploadBackup("2026-08-24", "{}")).rejects.toThrow(/403 forbidden/);
    expect(calls).toHaveLength(1);
  });

  /**
   * **푼 결과가 원본과 같아야 한다.** 압축은 용량을 줄이려고 넣은 것이고, 여기서 한 글자라도
   * 어긋나면 백업이 아니라 못 읽는 파일 더미가 된다. 복원은 이 레포 밖에서 `gunzip`으로
   * 이뤄지므로 그 도구가 읽는 형식인지까지 여기서 고정한다.
   */
  it("gzip으로 담고, 풀면 원본 그대로다", async () => {
    const calls = stubFetch(response(200));
    const body = JSON.stringify({ posts: [{ title: "주님이 네 악을", content: "한글도 그대로" }] });

    const result = await uploadBackup("2026-08-24", body);

    const sent = Buffer.from(calls[0].init.body as Uint8Array);
    expect(gunzipSync(sent).toString("utf8")).toBe(body);
    // gzip 매직 넘버 — gunzip이 읽는 그 형식이다
    expect([sent[0], sent[1]]).toEqual([0x1f, 0x8b]);
    expect(calls[0].init.headers).toMatchObject({ "content-type": "application/gzip" });
    // 알리는 크기는 압축 후다 — 실제로 자리를 차지하는 값이어야 한다
    expect(result.bytes).toBe(sent.byteLength);
  });

  it("버킷을 만든 뒤에도 실패하면 던진다", async () => {
    stubFetch(response(400, BUCKET_MISSING), response(200), response(500, "boom"));

    await expect(uploadBackup("2026-08-24", "{}")).rejects.toThrow(/500 boom/);
  });
});

/**
 * 지우는 코드가 없던 동안 백업이 27장 601MB까지 쌓였고, 그게 Supabase 무료 1GB를 넘긴
 * 원인의 절반이었다. 한 장이 곧 블로그 전문 한 벌이라 **장수가 그대로 용량이다.**
 */
describe("pruneBackups", () => {
  const listed = (...names: string[]) =>
    new Response(JSON.stringify(names.map((name) => ({ name }))), { status: 200 });

  /** 오래된 것부터 하루씩 거슬러 `db/2026-09-19.json` 꼴로 만든다 */
  function days(count: number): string[] {
    return Array.from({ length: count }, (_, index) => {
      const day = new Date(Date.UTC(2026, 8, 19) - index * 86_400_000);
      return `${day.toISOString().slice(0, 10)}.json.gz`;
    });
  }

  it("일주일치를 넘긴 만큼만 지운다 — 남는 것은 최신 7장이다", async () => {
    const all = days(10);
    const calls = stubFetch(listed(...all), response(200));

    const { deleted } = await pruneBackups();

    expect(deleted).toEqual(all.slice(KEEP_BACKUPS));
    expect(deleted).toHaveLength(3);
    // 지우는 것은 옛것뿐이다 — 오늘 것이 섞이면 백업이 아니라 사고다
    expect(deleted).not.toContain("2026-09-19.json.gz");

    expect(calls[1].url).toBe("https://example.supabase.co/storage/v1/object/backups");
    expect(calls[1].init.method).toBe("DELETE");
    expect(JSON.parse(String(calls[1].init.body)).prefixes).toEqual([
      "db/2026-09-12.json.gz",
      "db/2026-09-11.json.gz",
      "db/2026-09-10.json.gz",
    ]);
  });

  it("일곱 장 이하면 아무것도 지우지 않는다 — 삭제 요청 자체를 보내지 않는다", async () => {
    const calls = stubFetch(listed(...days(KEEP_BACKUPS)));

    const { deleted } = await pruneBackups();

    expect(deleted).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("폴더 자리 표시자는 세지 않는다", async () => {
    const calls = stubFetch(listed(".emptyFolderPlaceholder", ...days(8)), response(200));

    const { deleted } = await pruneBackups();

    // 자리 표시자를 한 장으로 셌다면 여기서 일곱 장만 남기려다 하나를 덜 지운다
    expect(deleted).toEqual(["2026-09-12.json.gz"]);
    expect(calls).toHaveLength(2);
  });

  it("목록을 못 읽으면 던진다 — 조용히 넘기면 정리가 안 된 채로 지나간다", async () => {
    stubFetch(response(500, "boom"));

    await expect(pruneBackups()).rejects.toThrow(/목록 조회 실패: 500 boom/);
  });

  /**
   * 압축을 넣기 전에 쌓인 27장은 `.json`이다. 새 확장자만 세면 그 옛 파일들이 정리 대상에서
   * 빠져 **영원히 남는다** — 애초에 용량을 넘긴 원인이 그것들이었다.
   */
  it("압축 이전의 `.json`도 함께 센다 — 그것들이 용량을 넘긴 장본인이다", async () => {
    const legacy = ["2026-09-12.json", "2026-09-11.json", "2026-09-10.json"];
    const calls = stubFetch(listed(...days(KEEP_BACKUPS), ...legacy), response(200));

    const { deleted } = await pruneBackups();

    expect(deleted).toEqual(legacy);
    expect(JSON.parse(String(calls[1].init.body)).prefixes).toEqual([
      "db/2026-09-12.json",
      "db/2026-09-11.json",
      "db/2026-09-10.json",
    ]);
  });

  it("삭제가 거절되면 던진다", async () => {
    stubFetch(listed(...days(9)), response(403, "forbidden"));

    await expect(pruneBackups()).rejects.toThrow(/삭제 실패: 403 forbidden/);
  });
});
