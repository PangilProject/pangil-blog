# 05. Backend & Data — ERD · 인증/보안 · 마이그레이션

> 상태: **확정 (Phase 6 완료: 6-1 스키마 / 6-2 인증·보안 / 6-3 티스토리 마이그레이션)**
> 선행 문서: `docs/00-product-vision.md`, `docs/01-user-scenarios.md`, `docs/02-information-architecture.md`, `docs/03-design-system.md`, `docs/04-frontend-architecture.md`, `docs/decisions/001-editor-toolbar-model.md`, `docs/decisions/002-jsonb-vs-tables.md`
> 최종 갱신: 2026-08-18

---

## 0. 판단 기준

트래픽은 무료 티어 한도의 1% 미만(04 §0). 성능이 아니라 다음이 기준이다.
① 타입 안전과 검증의 단일화(04의 Zod 3중 검증과 정합) ② 1인 운영의 단순성 ③ 무료 티어 안에서 운영 비용 0원 ④ 콘텐츠 저작권/공개 정책 대응 여지 확보.

---

## 1. 데이터 모델 (Phase 6-1)

### 1.1 결정: posts 단일 테이블 + JSONB content

타입별 테이블 분리(정규화/CTI)와 단일 테이블 + JSONB를 검색·인덱싱·마이그레이션·Prisma 타입 안전성·Zod 3중 검증 정합성 관점에서 논증한 뒤 **posts 단일 테이블 + `content` JSONB**를 채택했다. 전문은 `docs/decisions/002-jsonb-vs-tables.md`(ADR-002).

핵심 근거 요약:
- 전 화면(H/D/F/A/S)의 쿼리 조건이 스칼라 컬럼으로 완결된다 — content 내부를 WHERE에 쓰는 화면이 없다(02 전 화면 검증). content 내부가 읽히는 순간은 상세/OG 렌더링뿐이고 그때는 행 전체를 읽는다.
- 리치 필드(Tiptap JSON — 답변·설교 body·summary·묵상과 기도)는 테이블을 분리해도 JSONB로 남는다(04 §2.4, 결정 로그 #8). 분리의 실익이 스칼라 몇 개의 NOT NULL뿐이다.
- 정규화 시 자동 저장 `upsertDraft(postId, content)` 파이프라인(04 §2.2)이 "폼 상태 ↔ 행 집합 diff"로 변질되고, "찬양 섹션 순서 = 배열 인덱스"(04 §2.5 확정)와 충돌한다.
- 주변 테이블(tags/stats/청구기호/crawl_runs/assets)이 posts 하나를 참조 → FK 단일 지점 유지(polymorphic 회피).

### 1.2 채택하며 수용한 반대 논거 (설계 반영)

| # | 수용 사항 | 반영 |
|---|----------|------|
| 1 | 그림자 스키마(JSONB 내부 구조 변경이 migrate 이력에 안 남음) | `contentSchemaVersion` 컬럼 + content 마이그레이션 규약(§1.6) |
| 2 | DB 제약 무력화 | 발행 게이트 단일화 — `publishPost`만 status를 PUBLISHED로 전환(§3.4) |
| 3 | 컬럼 승격 애매함 | 승격 기준 명문화(§1.5) |
| 4 | 전문 검색 미래 비용 | `searchText` 컬럼 + `pg_trgm` GIN. **Phase 8에서 MVP로 승격** — §4A. 스키마·인덱스는 무변경 확장 경로 그대로, 시점만 앞당김 |

### 1.3 ERD

```
┌────────────┐       ┌──────────────┐        ┌──────────┐      ┌──────┐
│ categories │◀──────│    posts     │───────▶│ post_tags│─────▶│ tags │
└────────────┘  FK?  └──────┬───────┘  M:N   └──────────┘      └──────┘
                       ▲     ▲    ▲
        ┌──────────────┘     │    └──────────────┐
┌───────┴──────┐   ┌─────────┴────┐   ┌──────────┴───┐   ┌──────────────────────┐
│  crawl_runs  │   │    assets    │   │ (stat_events)│   │ call_number_counters │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────────────┘
       1:1(postId)      N:1(postId?)      postId? (FK 아님, 로그성)   type PK, 관계 없음
```

- `stat_events`는 append-only 로그성이라 posts에 FK를 걸지 않는다(postId는 참조용 문자열). 글 삭제가 과거 통계를 지우면 안 됨.
- `call_number_counters`는 타입별 시퀀스 상태 테이블(관계 없음).

### 1.4 Prisma 스키마 (확정 초안 — 구현 시 migrate로 생성)

```prisma
enum PostType     { QT SERMON PRAISE TECH }
enum PostStatus   { DRAFT PUBLISHED PRIVATE }
enum Site         { HUB DEV FAITH }
enum CrawlStatus  { SUCCESS FAILED SKIPPED }
enum StatEventType{ PAGEVIEW LEAVE }
enum Device       { MOBILE DESKTOP }

model Post {
  id                   String     @id @default(cuid())
  legacyId             Int?       @unique              // 티스토리 원본 글 ID (마이그레이션 추적·멱등)
  type                 PostType
  status               PostStatus @default(DRAFT)
  title                String
  slug                 String?    @unique              // 발행 시 확정, DRAFT는 null
  content              Json                             // Zod discriminated union (§2)
  contentSchemaVersion Int        @default(1)
  excerpt              String?                          // TECH 목록 카드 · OG description
  thumbnailUrl         String?                          // TECH 목록 카드
  searchText           String?                          // 발행 시 title+본문 평문 추출 (검색용, §4A)
  categoryId           String?                          // TECH만 사용
  category             Category?  @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  callNumber           Int?                             // 발행 시 부여, 이후 불변
  publishedAt          DateTime?                        // 최초 발행 시각 / 마이그레이션 원본 작성일
  createdAt            DateTime   @default(now())
  updatedAt            DateTime   @updatedAt
  tags                 PostTag[]
  crawlRun             CrawlRun?
  assets               Asset[]

  @@unique([type, callNumber])
  @@index([type, status, publishedAt(sort: Desc)])     // 전 목록·피드 커버
  @@index([status, updatedAt])                          // A-02 초안함
  // + searchText에 pg_trgm GIN 인덱스 (Prisma 스키마 밖 raw migration, §4A)
}

model Category {
  id        String   @id @default(cuid())
  name      String   @unique
  slug      String   @unique
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  posts     Post[]
}

model Tag {
  id    String    @id @default(cuid())
  site  Site                                            // dev/faith 동명 태그 공존 허용
  name  String
  posts PostTag[]
  @@unique([site, name])
}

model PostTag {
  postId String
  tagId  String
  post   Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag    Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([postId, tagId])
}

model CallNumberCounter {
  type       PostType @id
  lastNumber Int      @default(0)
}

model CrawlRun {
  id              String      @id @default(cuid())
  runDate         DateTime    @unique @db.Date          // KST 기준 date — 중복 실행 방지 멱등 키
  status          CrawlStatus
  postId          String?     @unique                   // 생성한 DRAFT (1:1)
  post            Post?       @relation(fields: [postId], references: [id], onDelete: SetNull)
  questionCount   Int?                                   // 파싱 검증 결과 (6·4 아니면 FAILED)
  annotationCount Int?                                   // 0 허용
  errorMessage    String?                                // Slack 알림 본문과 동일 소스
  startedAt       DateTime    @default(now())
  finishedAt      DateTime?
}

model StatEvent {
  id          BigInt        @id @default(autoincrement())
  site        Site
  eventType   StatEventType
  path        String
  postId      String?                                    // FK 아님(로그성)
  referrer    String?
  utmSource   String?
  visitorHash String                                     // 무상태 일일 로테이션 해시 (§4.2)
  device      Device
  durationMs  Int?                                       // LEAVE 이벤트의 체류 시간
  occurredAt  DateTime      @default(now())
  @@index([site, occurredAt])
}

model Asset {
  id          String   @id @default(cuid())
  postId      String?                                    // 업로드 시점 초안 미저장 가능 → nullable
  post        Post?    @relation(fields: [postId], references: [id], onDelete: SetNull)
  storagePath String                                     // post-images/{postId|orphan}/{nanoid}.{ext}
  width       Int?                                        // next/image 요구 (04 §3.3)
  height      Int?
  mimeType    String
  bytes       Int?
  createdAt   DateTime @default(now())
}
```

파생 규칙: `site = type === 'TECH' ? DEV : FAITH` — 컬럼으로 두지 않는다(type의 함수). HUB는 글이 없는 정적 페이지라 posts와 무관, stat_events에서만 site로 등장.

### 1.5 컬럼 승격 기준 (ADR-002 수용 #3, 명문화)

> **WHERE / ORDER BY / 목록 카드 / 피드에 등장하면 컬럼, 상세 지면에서만 읽으면 JSONB.**

현재 이 기준으로 승격되는 content 내부 필드는 **없다**(F-01 카드 = 타입 배지 + 제목 + 날짜뿐, scriptureRef조차 목록에 없음). 미래에 승격이 필요해지면 이 기준으로 판단하고 ADR을 남긴다.

### 1.6 content 마이그레이션 규약 (ADR-002 수용 #1)

content 구조 변경 시:
1. Zod 스키마에 버전 분기 추가(`contentSchemaVersion` 기준)
2. backfill 스크립트를 `scripts/content-migrations/`에 남기고 실행
3. 전 행 버전 통일 후 분기 제거

safeParse 폴백(04 §2.4: 렌더링 전 실패 시 raw 폴백 렌더 + Slack 알림)은 최후 방어선으로 유지.

---

## 2. content JSONB 스키마 (04 §2.4를 02 §5 필드 스펙과 대조해 확정)

```ts
const TiptapDoc = z.object({ type: z.literal("doc"), content: z.array(z.any()) });

const QtContent = z.object({
  kind: z.literal("QT"),                     // discriminator (posts.type과 검증: type === content.kind)
  scriptureRef: z.string(),                  // "열왕기상 2장 41~46절"
  scriptureBody: z.string(),                 // 기본 펼침, 편집 가능 (02 §5.2)
  annotations: z.array(z.object({            // 365qt 원문 주석 블록, 0개 허용
    term: z.string(),
    verseRef: z.string().optional(),
    body: z.string(),
  })),
  questionGroups: z.array(z.object({         // 4그룹 6문 (샘플 검증)
    group: z.string(),                       // 내용관찰/연구와 묵상/느낀 점/결단과 적용
    questions: z.array(z.object({
      label: z.string(),                     // "1", "5-1" 등
      text: z.string(),                      // 질문 원문 (편집 가능)
      answer: TiptapDoc,                     // 사용자 답변
    })),
  })),
  summary: TiptapDoc,
});

const SermonContent = z.object({
  kind: z.literal("SERMON"),
  scriptureRef: z.string(),
  scriptureBody: z.string(),                 // 필수(발행 시) (02 결정 로그 #13)
  body: TiptapDoc,                           // 라이브 속기, 슬림 서식 (소제목/굵게/인용/목록)
  summary: TiptapDoc.optional(),             // 예배 후 선택
});

const PraiseContent = z.object({
  kind: z.literal("PRAISE"),
  youtubeUrl: z.string().url(),
  sections: z.array(z.object({
    id: z.string(),                          // nanoid — 순서는 배열 인덱스 (order 필드 없음, 04 §2.5)
    label: z.enum([
      "Intro","Verse","Pre-Chorus","Chorus","Bridge","Interlude","Outro",
    ]).or(z.object({ custom: z.string() })), // 직접 입력 허용 (02 §5.4)
    lyrics: z.string().default(""),          // 빈 섹션 허용 ("16 Bar" 연주 메모)
  })),
  meditationAndPrayer: TiptapDoc,            // 가사 묵상 + 기도문 단일 영역 (02 §5.4)
});

const TechContent = z.object({
  kind: z.literal("TECH"),
  body: TiptapDoc,                           // 티스토리식 고정 툴바 WYSIWYG 정본 (ADR-001)
});

export const PostContent = z.discriminatedUnion("kind", [
  QtContent, SermonContent, PraiseContent, TechContent,
]);

// 스키마 2벌 (04 §2.4)
export const PublishSchema = PostContent;                   // 구조 필수 + refine
// DraftSchema = 커스텀 partial 유틸 (Zod v4 deepPartial deprecated — 04 미결 #4 해소)
//   kind만 필수, 나머지 재귀적 optional. 자동 저장은 무엇이든 저장
```

`kind`를 명시적 discriminator로 둔 이유: posts.type과 중복이지만, content 단독으로도 자기 기술적이어야 safeParse·백필 스크립트·로컬 미러(`draft:{type}:{id}`, 04 §2.3)가 행 컨텍스트 없이 동작한다. 저장 시 `posts.type === content.kind` 일치를 검증한다.

큐티 답변 공란은 **UI 레벨 경고만, 발행 차단 없음**(02 §6, 04 §2.4) — 스키마 refine이 아니라 UI에서 처리.

---

## 3. 인증 / 권한 / 보안 (Phase 6-2)

### 3.1 보안 경계의 실체 — RLS ≠ 실 경계

모든 DB 접근이 Prisma(`DATABASE_URL`, pgbouncer 경유)를 타고, 이때 DB 롤은 **RLS를 우회한다.** 브라우저는 DB 자격증명을 절대 갖지 않으며 supabase-js를 클라이언트에서 쓰지 않는다(이 규약을 AGENTS.md에 명문화). 접근 경로는 셋뿐:

| 경로 | 방식 | 실 경계 |
|------|------|--------|
| 공개 페이지 | 서버 Prisma 빌드 → 정적 HTML 서빙(04 §1). 클라이언트 런타임 DB 접근 0 | 쿼리에서 `status=PUBLISHED` 강제 |
| 관리(/admin) | Server Component/Action, Prisma | middleware 인증 + **Server Action 가드** (이중) |
| 크롤러 | GitHub Actions → 스코프 토큰 HTTP 엔드포인트 | 크롤러 토큰 검증(§3.3) |

**RLS는 후방 방어선(defense-in-depth)으로만** — 모든 테이블 RLS enable + 정책 없음(전면 거부). 미래에 누가 supabase-js를 붙이는 사고를 대비한 백스톱. 공개 읽기는 Prisma 서버 렌더 전담이라 anon SELECT 정책조차 열지 않는다.

### 3.2 인증 — 단일 계정 + 이중 가드

- Supabase Auth 이메일/비번 단일 관리자 계정(A-00).
- **middleware만으론 부족.** Server Action은 별도 POST 엔드포인트로 직접 호출 가능하므로, 모든 변경 액션(`upsertDraft`/`publishPost`/`updatePost`/`setPrivate`/`deletePost`/카테고리·태그 관리)은 함수 첫 줄에서 세션 검증을 공통 래퍼 `withAdmin(action)`으로 강제.
- CSRF: Next.js Server Actions는 same-origin(Origin/Host) 검증 내장 → 추가 조치 불요. 단, 스코프 토큰 Route Handler(§3.3·§4)는 각자 인증을 직접 검증.
- **MFA(TOTP) 강력 권장.** 계정 탈취 = 전 시스템 장악인 1인 구조에서 비용 대비 효과 최상.

### 3.3 크롤러 쓰기 경로 — service role key 미부여

**GitHub Actions에 service role key(또는 DATABASE_URL)를 넣지 않는다.** 크롤러 전용 스코프 토큰으로 보호된 인입 엔드포인트만 준다.

```
GitHub Actions ──(Bearer CRAWLER_INGEST_TOKEN)──▶ POST /api/crawler/ingest
  → 토큰 상수시간 비교 → 페이로드 Zod 검증(질문6·그룹4 규칙, 02 §6)
  → crawl_runs upsert(runDate 멱등) → QT DRAFT 생성 (오직 이것만)
  → 실패/SKIPPED 시 Slack 알림
```

- 토큰 유출 시 폭발 반경 = "QT DRAFT 생성"뿐. 읽기·발행·삭제·타 타입 불가. service role key(전권) 유출과 급이 다르다.
- 04 §4 제약("크롤러는 DRAFT 생성만, revalidate 호출 금지")을 **권한 레벨에서 물리적으로 보장** — 토큰으로 도달 가능한 코드 경로에 revalidateTag가 없다.
- 멱등: `crawl_runs.runDate @@unique` + upsert → 재실행/중복 트리거 무해(프리모템 #1).
- 시크릿은 GitHub Actions Secrets / Vercel 환경변수만(AGENTS.md 준수).
- (하드닝, Backlog 후보) Prisma용 DB 롤을 superuser 대신 public 테이블 DML만 가진 전용 롤로 분리, 마이그레이션은 별도 direct URL. 1인엔 과할 수 있어 보류.

### 3.4 publishPost 게이트 (ADR-002 수용 #2)

status를 PUBLISHED로 바꾸는 유일한 코드 경로:

```
publishPost(postId) = withAdmin(async () => {
  PublishSchema.parse(content)              // 구조·slug·TECH category 강제
  tx: callNumber 부여(row lock, §5) → slug 파생 → status=PUBLISHED
      → revalidateTag 일괄(04 §1.2) → redirect(공개 페이지)
})
```

트랜잭션 단일 → 청구기호 부여와 상태 전환이 원자적(결번·중복번호 방지). 크롤러 토큰으론 도달 불가.

### 3.5 "1인이라 생략" vs "1인이어도 필수"

| 반드시 (1인이어도) | 생략 가능 (1인이라서) |
|--------------------|----------------------|
| /admin 인증 + 전 변경 액션 서버 측 가드 | 역할/권한 매트릭스(계정 1개) |
| 크롤러 스코프 토큰(service role 미부여) | 행 소유권 체크(전 행 동일 소유자) |
| 시크릿 env/Secrets 전용, 하드코딩 금지 | 관리자 행위 감사 로그(크롤러는 crawl_runs로 충분) |
| 공개 쿼리 `status=PUBLISHED` 강제 | 정교한 rate-limit 티어링 |
| beacon 봇·Origin 필터 + 얇은 rate limit | API 버저닝 |
| RLS deny-by-default 백스톱 / MFA 권장 | |

---

## 4. 통계 수집 (Phase 6-2 · 04 미결 #3 해소, 수집만 / 대시보드는 Backlog)

공개 POST beacon. **클라이언트를 신뢰하지 않는 것**이 설계 축.

```
페이지 JS ──(navigator.sendBeacon)──▶ POST /api/stat
  payload(Zod): { site, eventType(PAGEVIEW|LEAVE), path, postId?, referrer?, durationMs? }
  서버 파생(클라 값 미신뢰): ip·ua → device, visitorHash, occurredAt
  → 봇/Origin 필터 통과 시 stat_events append
```

### 4.1 봇 필터 · Origin

- beacon은 JS 실행 시에만 발화 → 비렌더 크롤러 자연 배제
- 렌더링 봇(Googlebot 등) UA 정규식 차단
- Origin이 자사 호스트(hub/dev/faith)가 아니면 드롭
- `path/referrer`는 봇 조작 가능 → 카운트 판단에 쓰지 않음(집계 시 참고만)
- **관리자 본인 방문 제외**: 공개 페이지에서 **관리자 세션 감지 시 beacon 미발화**(07 M6 DoD "내 방문 제외"). 보조로 집계 단계에서 자기 visitorHash 제외 가능. 내 조회가 통계를 오염시키면 동기 시스템(00 §2.2 신뢰 문제)이 다시 무너짐

> **M6 구현 정정 — "세션 감지"의 방법.** 공개 지면은 통째로 캐시되고(ADR-003) 비콘도 그 캐시된 HTML에 실려 나가므로, 지면에서 세션을 확인할 수 없다. 확인하려면 공개 지면마다 Supabase auth 왕복이 붙고 그건 캐시를 버리는 것과 같다. 그래서 **`/admin`을 지날 때 proxy가 이미 확인한 사실**을 옵트아웃 쿠키(`stat_optout=1`, 1년, 비httpOnly) 한 장에 적고, 이후 비콘은 `document.cookie` 한 줄만 보고 침묵한다. 서버도 같은 쿠키를 한 번 더 본다 — 캐시된 옛 HTML이 남아 있는 동안에도 내 조회가 새지 않아야 한다. 이 쿠키에는 비밀이 없다(값이 `1`이다). 남이 심으면 자기 방문이 안 세어질 뿐이므로 공격이 아니라 옵트아웃이고, 비콘이 읽어야 하니 httpOnly일 수 없다. **한계**: 다른 브라우저·시크릿창으로 내 글을 보면 세어진다 — 그때는 위에 적힌 보조 수단(집계 시 visitorHash 제외)이 남는다.
>
> **rate limit은 fail open이다.** Upstash env가 없으면 상한 없이 수집하고 서버 로그에 경고를 남긴다. 크롤러 토큰 검증(06 §1.1, fail closed)과 반대인데 의도적이다 — 그쪽은 못 막으면 남이 초안을 만들지만, 여기서 못 막으면 통계 행이 늘 뿐이다. 반대로 여기서 fail closed면 env 하나 빠진 것으로 통계 전체가 조용히 죽는다. **죽은 줄도 모르는 계측이 부풀려진 계측보다 나쁘다.**

### 4.2 visitorHash — 무상태 일일 로테이션

`sha256(STAT_SALT : dateKST : ip : ua)`. `STAT_SALT`는 고정 시크릿, `dateKST`가 매일 실효 솔트를 바꿈 → 날짜 교차 추적 불가(쿠키리스 익명). 솔트 저장소 불요.

### 4.3 rate limit

Upstash Redis(무료) + `@upstash/ratelimit`, IP 기준 코스한 상한(예 60/min)으로 테이블 bloat 방어. **이 Upstash 프리미티브는 Backlog 1순위 "자체 댓글"의 honeypot+rate limit(00 §5.2)에서 재사용** → 단일 목적 의존성이 아님.

인덱스는 `@@index([site, occurredAt])` 하나만(수집 우선, 집계는 나중).

### 4.4 LEAVE의 한계 (M6 실측)

브라우저에서 확인한 것과 확인된 한계를 남긴다 — 나중에 대시보드를 만들 때 이 숫자를 어디까지 믿을지가 여기서 결정된다.

| 경로 | 결과 |
|------|------|
| 페이지 진입 → 사이트 안에서 다른 글로 이동 | LEAVE 기록됨 (클라이언트 내비게이션 cleanup) |
| 탭 전환·홈으로 나가기 | LEAVE 기록됨 (`visibilitychange` → hidden) |
| **창·탭 전체 닫기** | **유실될 수 있다** |

`sendBeacon`은 규격상 best-effort다. 탭을 닫을 때 크롬이 큐를 비워 주는 것이 보통이지만 보장은 아니고, 특히 **시크릿 창의 마지막 탭을 닫으면 프로필이 파기되면서 큐가 버려진다**(실측으로 확인). `pagehide`와 `visibilitychange`를 함께 듣는 것으로 잡을 수 있는 만큼은 잡았고, 그 이상은 브라우저의 영역이다.

그래서 **PAGEVIEW 수는 신뢰하고, 평균 체류는 하한으로 읽는다.** LEAVE가 없는 PAGEVIEW를 "0초 체류"로 세면 안 된다 — 그건 오래 읽고 창을 닫은 사람일 가능성이 높다.

한 번 더: **LEAVE는 페이지 방문당 최대 하나**다. 탭을 전환한 시점에 닫히고, 돌아와서 더 읽어도 다시 열리지 않는다. 배경 탭에 열어 두고 나중에 읽는 사람의 체류는 짧게 기록된다. 수집 단계에서 이 이상 정밀해질 이유가 없다 — 대시보드가 Backlog이므로(00 §5.2) 정밀도를 먼저 올리면 쓰이지 않는 정밀도가 된다.

개발 모드에서는 PAGEVIEW가 **두 번** 기록된다. React StrictMode가 effect를 mount→unmount→remount로 돌리기 때문이고 프로덕션에는 없다. 그때 함께 생기던 0ms LEAVE는 바닥값(500ms)으로 막았다 — 0.2초 체류 기록은 어디서 생겨도 체류에 대해 아무것도 말해주지 않는다.

---

## 4A. 검색 (Phase 8에서 MVP 승격 — pg_trgm)

작성자 본인의 1순위 옛 글 접근 경로가 "제목·내용 검색"이므로 전문 검색을 Backlog에서 **MVP로 승격**한다(D-04/F-05). 외부 검색엔진 없이 Postgres 내장으로 해결.

- **엔진 = `pg_trgm`(트라이그램) + GIN.** Supabase 지원. 한국어는 Postgres 기본 FTS(형태소 분석기 부재)가 약해 부분 매칭이 안 되므로, 글자 3-gram 방식의 `pg_trgm`을 채택("전도서" → "전도서를"도 매칭). `ILIKE`/유사도 검색을 GIN으로 가속.
- **`searchText` 컬럼**: 발행(및 마이그레이션 적재) 시 `title` + 본문 **평문**을 추출해 채운다. 본문은 Tiptap JSON이므로 **§렌더 파이프라인의 renderRichText 노드 순회에 "평문 추출" 타깃을 추가**(04 §3.1)해 재사용 — 렌더(React)·검색(평문)·export(마크다운)가 같은 순회의 출력만 다른 셋.
- **인덱스**: `CREATE INDEX … USING gin (searchText gin_trgm_ops)` — Prisma 스키마로 표현 불가하므로 raw migration으로 추가(구조 변경 아님, ADR-002 수용 #4 경로 그대로).
- **스코프**: 검색은 site 단위(dev/faith). 공개 쿼리라 `status=PUBLISHED` 강제.
- 확장 여지: 규모가 커지면 `tsvector`+한국어 사전(mecab 등)로 교체 가능하나, 1인 1,000편엔 pg_trgm으로 충분.

---

## 5. 청구기호 시퀀스 (03 §6.3 이행)

- 부여 시점: **최초 발행 트랜잭션 내부**(`UPDATE … SET lastNumber = lastNumber + 1 RETURNING` — row lock으로 동시성 안전). DRAFT는 null.
- PRIVATE 전환·재공개·수정: 번호 불변. 삭제 시 결번 허용(재사용 없음 — 청구기호는 이력이지 카운트가 아님).
- 표기 매핑(프레젠테이션 계층): `QT-1043` / `PR-0388`(PRAISE) / `SR-0104`(SERMON) / TECH `0072 · 카테고리`.
- **부여 순서**: 신규 글 = **발행 순서**(원본 작성일 아님). 크롤링된 QT를 며칠 밀려 발행하면 callNumber가 달력과 어긋날 수 있으나, 청구기호는 "통산 일련번호(이력)"이므로 발행순이 정본. **마이그레이션만 예외로 원본 작성일순 소급**(§6.4).
- 마이그레이션 소급 부여: §6.4.

---

## 6. 티스토리 마이그레이션 (Phase 6-3)

### 6.0 전제 정정 — 백업은 XML이 아니라 HTML

현재 티스토리 백업에 워드프레스식 단일 XML은 없다. 실제 산출물:
- zip 해제 시 **개별 글 + 이미지가 각각 하위 폴더**에 존재
- html 파일명 = `{id}-{title}.html`, 앞 숫자 = 원본 티스토리 글 ID(= `blog.tistory.com/{id}`)
- 백업 포함: 작성된 글, 첨부 이미지/파일/동영상. 백업 제외: 댓글·방명록, 통계, 스킨, 링크
- 요청 시점 스냅샷

→ 파싱 대상은 **글별 렌더링된 HTML**. 표시용 HTML에서 메타·본문을 역추출한다. (00 §3.5·플레이북의 "백업 XML" 표현은 이 사실로 정정됨.)

### 6.1 파이프라인 (4단계, dry-run 기본)

```
[1 추출]  zip 해제 → 폴더 순회 → {id}-{title}.html 파싱
            → { legacyId, title, publishedAt, category?, tags[], bodyHtml }
[2 변환]  bodyHtml ── 타입 판별 ──▶ 타입별 컨버터 ──▶ content JSONB (Zod safeParse 검증)
[3 자산]  bodyHtml <img> → Supabase Storage 업로드 → URL 치환 → assets 행
[4 적재]  원본일 오름차순 정렬 → 타입별 callNumber 소급 → slug 파생
            → status=PUBLISHED 삽입 → counters를 max로 세팅 → 전체 rebuild
```

`npm run migrate -- --dry-run`이 기본. dry-run은 DB 미기록, 리포트만(타입 판별, Zod 통과/실패, 이미지 목록, 날짜 결손, 검토 큐). AGENTS.md의 크롤러 dry-run 규약과 동일 정신.

### 6.2 타입 판별 & 변환 티어

> ⚠ **정정(M5 구현)**: 타입은 백업에 **메타로 있다**. `p.category`가 그대로 남아 있어 본문 신호 추측이 필요 없었다. 반대로 "블로그별 zip이 1차 분기(site)"는 사실이 아니었다 — 백업 **한 개**에 묵상과 기술이 섞여 있어 site도 카테고리로 가른다. 카테고리를 고르지 않은 32편만 글 단위로 손으로 정했다(`overrides.ts`).

> ⚠ **정정 2(2026-08-25, 두 번째 백업)**: 백업은 **두 벌**이다. 묵상은 2025-09-21에 두 번째 티스토리 블로그로 옮겨갔고 기술 글만 첫 블로그에 남았다. 두 백업은 서로 다른 세 가지를 요구한다.
>
> 1. **원본 글 ID가 1부터 다시 시작한다.** legacyId는 unique 멱등 키이므로 그대로 넣으면 두 번째 백업이 통째로 "이미 있음"으로 건너뛰어진다 → 백업마다 오프셋을 준다(`backups.ts`, 두 번째 = +10000).
> 2. **글 단위 예외 표(`overrides.ts`)도 백업마다 따로 쥔다.** 첫 백업의 134번은 학교 일지이고 두 번째의 134번은 주일 예배 설교다 — 한 표를 공유하면 설교가 기술 글이 된다(dry-run에서 실제로 그렇게 나왔다).
> 3. **카테고리 구조가 다르다.** 첫 블로그는 `묵상/QT`·`묵상/설교`, 두 번째는 `QT`·`설교`가 최상위다. `classify`는 두 모양을 다 받는다.
>
> 그래서 `--source=<백업 키>`가 **필수**다. 폴더 이름으로 짐작하지 않는다 — 틀리면 남의 판정을 씌운다.

타입은 백업에 메타로 없다. 본문 신호로 분류: 유튜브 iframe → PRAISE 후보 / "내용관찰·연구와 묵상·결단과 적용" 소제목 → QT / faith 소속·위 둘 아님 → SERMON / dev 소속 → TECH. 블로그별 zip이 1차 분기(site).

| 타입 | 난이도 | 변환 |
|------|--------|------|
| TECH | 쉬움 | bodyHtml → Tiptap(`generateJSON`). 티스토리 래퍼·인라인 스타일·figure·하이라이터 잔재 sanitize가 실무 8할. 코드블록 언어 라벨 유실만 수동 |
| 설교 | 중간 | 헤딩 앵커("Summary", 말씀 범위 패턴)로 scriptureRef/scriptureBody/body/summary 자동 분할 + 게이트 |
| 찬양 | 중상 | iframe src → youtubeUrl(확실). 굵은 라벨 정규식으로 sections 분해, `---` 이후 → meditationAndPrayer. 라벨 enum 밖 → custom/빈 섹션 |
| QT | 최상(그러나 최정형) | 6문4그룹 고정 템플릿이라 파서 튜닝 정확도 최고. 말씀→scriptureRef/Body, `-` 라인→annotations, 4헤딩→questionGroups, `:` 이후→answer, "Summary"→summary. 최대 난점 = 질문 원문/내 답변 경계 분리 |

### 6.3 자동 / 게이트 / 수동 경계

| 등급 | 대상 | 규칙 |
|------|------|------|
| 자동 확정 | 메타데이터, TECH 본문, 이미지 이관 | Zod 통과 시 무검토 |
| 게이트 필요 | QT·설교·찬양 구조 | 타입별 필수 구조 충족(QT 6문4그룹 / 찬양 URL+≥1섹션 / 설교 3필드) 실패 시 **검토 큐** |
| 수동 | 게이트 실패분 + 날짜 결손 + 찬양 라벨 모호 | 리포트 `review/`로 배출, 보정 후 재투입 |

> ⚠ **정정(M5 구현)**: 게이트 실패분을 `review/` 파일로 배출하지 않는다. **초안(DRAFT)으로 적재하고 A-02 초안함이 검토 큐를 겸한다.** 파일로 빼면 글이 레포 밖에 남아 잊히고, 다시 넣는 경로를 따로 만들어야 한다. 초안으로 두면 빈 지면을 공개하지 않으면서 글도 잃지 않고, 손으로 채우고 발행 버튼을 누르면 끝난다(실제 8편: 유튜브 주소 없는 찬양 4편 + 원본부터 본문이 빈 4편).

**모든 변환 결과는 적재 전 `PostContent` safeParse.** 통과 못 하면 DB에 안 들어간다. 02 §6 검증 규칙을 마이그레이션 게이트로 재사용. 바로 PUBLISHED여도 게이트+safeParse 이중으로 깨진 구조의 공개를 원천 차단.

### 6.4 callNumber · slug 소급 (전용 일괄 경로 — publishPost 게이트 우회)

1. 두 블로그 전량 → 타입별 원본 작성일 오름차순 정렬
2. 타입별 callNumber 1..N 부여 → `posts.callNumber`
3. slug 파생: faith `{qt|sr|pr}-{callNumber}`, TECH 제목 kebab(중복 시 `-2`). **한글 제목이라 kebab 결과가 비거나 ASCII가 없으면 `post-{callNumber}` 폴백**(신규 TECH도 동일 규칙 — slug 확정 규칙 준수)
4. content safeParse 통과분 삽입, **status=PUBLISHED (전량 즉시 공개 — Phase 6-3 결정 (가))**. 단 게이트 미통과 8편은 DRAFT이고 청구기호를 받지 않는다(번호에 구멍을 내지 않는다)
5. `call_number_counters.lastNumber = 타입별 max` → 신규 글이 이어받음
6. **대량 적재는 per-post revalidate 대신 전체 1회 rebuild.** 1,000편 × revalidateTag = 무료 티어 함수 폭탄. 04 §1.2 이벤트 무효화는 평시 운영용, 대량 적재는 예외로 일괄 빌드 반영.
7. 티스토리 구 URL 보존 의무 없음(00 §6.3, 301 불가). legacyId는 참고·재실행 멱등 키로만 보관.

### 6.5 날짜 리스크 (M5에서 해소)

✅ **해소**: 백업 HTML에 `p.date`가 **759편 전부** 있다(`2024-12-01 16:47:46`, KST 벽시계). RSS 크로스체크 폴백은 쓰지 않았다. 문자열을 그대로 `new Date()`에 주면 실행 환경 타임존으로 읽히므로 `+09:00`을 붙여 옮긴다. 아래는 당초 우려였다.

publishedAt이 백업 HTML에 있는지 미확인. callNumber 순서는 legacyId 오름차순으로 항상 정확하나, **정확 표시일**은 별도 확보 필요할 수 있음. 폴백 우선순위:
1. 백업 HTML `article:published_time` 메타 (샘플로 확인)
2. **개발 중 살아있는 티스토리 RSS·sitemap의 pubDate를 legacyId로 매핑**(권장 백업 경로)
3. 최후: legacyId 순서만 신뢰, 날짜 근사 (비권장 — 00 §7-6 위반)

### 6.6 이미지 이관 (04 §3.3 정합)

> ⚠ **정정(M5 구현)**: 실제 문제는 티스토리 CDN이 아니라 **velog CDN 618개**였다(65편). velog에서 옮겨 쓴 글들이다. 전부 내려받아 Storage로 옮겼다 — velog를 지우면 그 65편이 깨진다. 본문에 박힌 `data:image/...;base64`도 파일로 취급해 옮긴다.
> 확장자를 믿지 않고 **바이트를 본다**(`lib/images/probe.ts`): 백업에 `.dat`·확장자 없는 파일이 섞여 있고 그것들도 PNG였다. 폭·높이도 헤더에서 읽는다 — 이관은 서버에서 돌아 브라우저가 재주는 경로(04 §3.3)를 쓸 수 없다.
> 이관 한도는 15MB다(붙여넣기는 5MB 유지). 이미 발행된 글의 그림을 한도 때문에 잃는 것과 앞으로 붙여넣을 그림에 한도를 두는 것은 다른 판단이다. **버킷의 file_size_limit도 함께 올려야 한다.**
> 못 옮긴 것 23개: `attachment:UUID`만 남고 파일이 없는 10개(티스토리가 첨부를 내보내지 못함), HEIC 8개(브라우저가 그리지 못한다 — 이관 후 손으로 다시 올린다), 그 외 5개는 한도를 올려 해결.

- 백업 폴더의 로컬 이미지 우선 사용(스냅샷 포함) → Storage `post-images/{postId}/{nanoid}.{ext}`
- URL 치환, 원본 폭·높이 기록, assets 행 생성
- 티스토리 CDN 직링크 미보존(원본 폐기 시 깨짐 — 완전 이주 원칙)
- 실패 이미지는 플레이스홀더 + 검토 큐

### 6.7 파서 확정 범위 (M5에서 해소)

전략(§6.1)·타입 판별(§6.2)·티어(§6.2)·경계(§6.3)는 확정. **DOM 셀렉터(category·tags·bodyHtml 컨테이너)와 publishedAt 위치는 스킨 마크업 의존이라 구현 착수 시 실물 HTML 1개로 핀 고정** — 유일한 미확정. (본 세션에서는 샘플 없이 전략만 확정하기로 결정.)

✅ **해소(M5, 실물 759편)**. 픽스처는 `scripts/migrate-tistory/fixtures/`.

| 값 | 셀렉터 |
|----|--------|
| 제목 | `h2.title-article` |
| 카테고리 | `p.category` — `"?? 묵상/? QT(날솟샘)"` (이모지는 `?`로 깨져 온다) |
| 작성일 | `p.date` |
| 태그 | `div.tags` — `#a #b` 평문. **태그 안에 공백이 있어** `#`로 쪼갠다 |
| 본문 | `div.contents_style` |

---

## 7. 이 문서가 후속 Phase에 거는 제약

| 대상 | 제약 |
|------|------|
| 7 (크롤러) | `/api/crawler/ingest` 스코프 토큰 엔드포인트로만 쓰기. DRAFT 생성 전용, revalidate 금지. crawl_runs runDate 멱등. 파싱 검증(질문6·그룹4, 주석 0 허용) 결과를 crawl_runs에 기록. 실패 시 Slack |
| 8 (로드맵) | MVP 포함: on-demand revalidate 체계, beacon 통계 수집, 청구기호, 마이그레이션(전량·즉시 공개). faith 저작권 정책 확정을 Phase 8 의제로. Backlog: 통계 대시보드 UI, 자체 댓글(Upstash rate limit 재사용), Prisma 전용 DB 롤 분리 |
| 구현 | content 마이그레이션 규약(§1.6) 준수. 공개 쿼리 `status=PUBLISHED` 강제. supabase-js 클라이언트 미사용. 시크릿 env/Secrets 전용 |

---

### 6.8 스키마에 자리가 없던 것 (M5에서 추가)

이관은 "우리 스키마에 자리가 없어서 내용을 잃는" 경우를 두 개 드러냈다. 둘 다 content JSONB는
그대로 두고 **렌더·에디터 쪽만** 늘렸다(§1.5 컬럼 승격 기준과 무관).

- **표**: 138편에 298개. 렌더러·마크다운·평문 세 타깃에 표를 붙였다. 에디터 툴바에는 넣지
  않는다(ADR-001 최소 툴바) — 그런데도 Tiptap `TableKit`을 등록하는 이유는, 확장이 없으면
  이관한 글을 **한 번 편집하는 순간** 모르는 노드를 조용히 버리기 때문이다. 표를 만들 수단은
  늘리지 않고 있는 표만 지킨다.
- **코드 언어 7종**(java·swift·c·cpp·python·yaml·md): 사용자가 직접 고른
  `data-ke-language`에 실제로 등장한다. 티스토리 **자동 감지**는 SQL을 `routeros`·
  `angelscript`로 적어두므로 우리가 아는 이름일 때만 믿는다.

## 8. 미결정 사항 (갱신)

| # | 항목 | 해소 예정 |
|---|------|----------|
| 1 | **faith 원문(365qt 본문·질문·주석, 찬양 가사) 전체 공개 저작권 정책** — 6-3에서 전량 즉시 공개(가)로 결정했으나 정책 자체는 미해소. 완화 레버 = 글 단위 PRIVATE 전환(02 §3.2)이 이미 존재 | 8 |
| 2 | 마이그레이션 파서 DOM 셀렉터·publishedAt 위치 | ✅ M5 — §6.7 표 참조 |
| 3 | publishedAt 정확 날짜 확보 경로(RSS 크로스체크 채택 여부) | ✅ M5 — 백업 `p.date`가 759편 전부 있어 RSS 폴백 불필요(§6.5) |
| 4 | Prisma 전용 DB 롤 분리(하드닝) 채택 여부 | Backlog |
| 5 | DraftSchema partial 유틸 구현(Zod v4) | ✅ M1 — `lib/content/schema.ts`의 deepPartial |
| 6 | 통계 집계·이상치 정리·대시보드 UI | Backlog |

---

## 부록. Phase 6 결정 로그

1. **posts 단일 테이블 + JSONB content 채택 (ADR-002)**, content `kind` discriminator. 타입별 테이블 분리 기각
2. 수용 4개: contentSchemaVersion / 컬럼 승격 기준 / publishPost 발행 게이트 단일화 / searchText 통로(Phase 8에서 MVP 승격, §4A)
3. 주변 테이블 7종 확정 (categories, tags+post_tags, call_number_counters, crawl_runs, stat_events, assets)
4. slug: TECH 제목 kebab / faith `{qt|sr|pr}-{callNumber}` (전역 unique)
5. 태그 체계 `tag:{site}:{name}`으로 정밀화 (**04 §1.2 갱신 필요**: `tag:{name}` → `tag:{site}:{name}`, dev/faith 동명 교차 무효화 차단)
6. 실 보안 경계 = middleware + Server Action 가드 + 크롤러 스코프 토큰. RLS는 deny-by-default 백스톱(Prisma 경로엔 무력)
7. 크롤러에 service role key 미부여 — `/api/crawler/ingest` 스코프 토큰, DRAFT 생성 전용
8. beacon 통계: 무상태 일일 로테이션 visitorHash, 봇·Origin 필터, Upstash rate limit(자체 댓글 재사용). 수집 Day 1, 대시보드 Backlog
9. MFA 강력 권장, 공개 쿼리 status=PUBLISHED 강제
10. 백업 = HTML/폴더 전제 정정(XML 아님). 4단계 파이프라인 + dry-run 기본
11. **전량 이관, 적재 즉시 PUBLISHED (faith 포함) — 결정 (가).** faith 저작권 미결은 글 단위 PRIVATE 레버로 사후 처리 가능
12. callNumber/slug 적재 시 date순 소급, counters max 세팅, 대량 적재는 전체 rebuild(평시 이벤트 무효화의 예외)
13. `posts.legacyId int? @unique` 추가 (마이그레이션 추적·멱등·RSS 날짜 매핑 키)
14. publishedAt은 백업 메타 → RSS 크로스체크 → legacyId 순서 폴백. 순서는 legacyId로 항상 정확
