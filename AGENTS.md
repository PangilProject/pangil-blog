# AGENTS.md

> 이 문서는 이 레포에서 일하는 모든 AI 에이전트(및 사람)의 **단일 진실(single source of truth)**이다.
> Claude Code 전용 운영 팁은 `CLAUDE.md`가 이 문서를 얇게 확장한다(중복 규칙은 두지 않는다).
> 최종 갱신: 2026-08-18 (기획 Phase 1~9 완료 기준)

## 프로젝트 개요

묵상(QT/설교/찬양)과 기술 글을 함께 운영하는 **1인 전용** 블로그 도구.
관리자 1인(작성자)이 사용하며, 핵심 가치는 **"작성 진입 마찰 제로"** — 요일에 맞는
템플릿이 미리 채워진 초안으로 바로 작성을 시작할 수 있어야 한다.
과적합(작성자 1인의 루틴에 최적화)이 결함이 아니라 정체성이다(`docs/00` §1).

- 글 타입: `TECH`(기술) / `QT`(말씀 묵상, 월~토) / `SERMON`(설교 묵상, 일) / `PRAISE`(찬양 묵상, 매일)
- 3면 1몸: 루트(허브) / `dev.`(기술) / `faith.`(묵상), 하나의 Next.js 앱 + middleware 호스트 분기
- 365qt.com 크롤러가 매일 QT 초안을 자동 생성한다 (GitHub Actions)
- 성공 판정: **이주 후 90일간 티스토리로 회귀하지 않음** (`docs/07` §5)

## 작업 시작 전 반드시 읽을 문서 (순서대로)

1. `docs/00-product-vision.md` — 왜 만드는가, Non-goals
2. `docs/02-information-architecture.md` — 화면 목록과 번호 체계
3. `docs/05-backend-and-data.md` — ERD, 스키마 결정, 인증/보안
4. `docs/04-frontend-architecture.md` — 렌더링 전략, 에디터 상태, 파이프라인
5. 작업 대상 도메인의 상세 문서 (에디터 → `docs/02` §5·`docs/04` §2 / 크롤러 → `docs/06` / 마이그레이션 → `docs/05` §6)
6. `docs/decisions/` — 관련 ADR이 있으면 결정을 뒤집지 말 것. 뒤집어야 하면 새 ADR을 제안
7. `docs/07-roadmap.md` — 현재 마일스톤(M0~M6)과 DoD, MVP/Backlog 경계
8. `docs/08-launch-and-dev-setup.md` — 개발 환경 세팅(Supabase 이중 URL·CI·env), Phase 8 착수 결정 델타(검색 MVP·다크 토글·md export 등)

> **`docs/`는 레포에 없다**(`.gitignore` · `e8e141e`에서 의도적으로 뺐다). **로컬 디스크에만 있고
> 이력도 사본도 없다** — 브랜치를 옮기다 한 번 잃은 적이 있다. 이 트리를 잃으면 이 레포의 근거가
> 통째로 사라지므로, 기기를 바꾸거나 초기화하기 전에 **먼저 어딘가로 복사한다.**
> 위치: 이 레포 루트의 `docs/`.

## 기술 스택

- **Next.js App Router + TypeScript (strict)** — 서버 컴포넌트 우선
- **Supabase** (PostgreSQL, Auth, Storage) + **Prisma**
- **Tailwind CSS + shadcn/ui**
- **Zod** (JSONB content 스키마 검증 — 저장/발행/렌더링 3중)
- **Tiptap** (에디터 리치 텍스트), **react-hook-form + @hookform/resolvers**, **dnd-kit**(찬양 섹션), **nanoid**
- **Shiki**(서버 사이드 코드 하이라이팅), **satori**(OG 카드 — `@vercel/og`/`next/og`가 아니다. Node 24에서 그쪽 래스터화가 `Unsupported input`으로 죽어 satori를 직접 쓴다. `lib/og/card.tsx` 머리 주석에 경위가 있다)
- **next-themes**(다크모드 수동 토글 + OS 기본 + 무FOUC)
- **@upstash/ratelimit + Upstash Redis**(통계·향후 댓글 rate limit)
- **pg_trgm**(Postgres 확장 — 검색 GIN. dev/prod 양쪽 프로젝트에 `create extension` 활성화)
- 배포: **Vercel** (Hobby) / 크롤러·자동화: **GitHub Actions** / watchdog: **Vercel Cron**
- 테스트: **Vitest**(단위) + 필요 최소 E2E

### 버전 고정 정책 (프리모템 #6 — "안 만지면 안 깨지는" 구조)

- **모든 의존성은 `package-lock.json`으로 정확 버전 고정.** 락파일을 반드시 커밋한다.
- 위 인벤토리 **외 라이브러리 추가는 승인 후.** "편해 보여서" 추가 금지.
- 임의 메이저 업그레이드 금지. 업그레이드는 별도 작업으로 분리하고 근거를 남긴다.
- 정확한 semver는 설치 시점에 lock에 박히며, 이 문서는 **인벤토리와 정책**만 관리한다.

## 폴더 구조 규칙

```
/
├── app/
│   ├── (public)/{hub,faith,dev}/   # 공개 3면 (H·F·D 화면). 서버 컴포넌트 기본
│   ├── admin/                      # A-00~08. 인증 필요. middleware + withAdmin 이중 가드
│   ├── api/
│   │   ├── crawler/ingest/         # 크롤러 수신 (스코프 토큰)
│   │   ├── crawler/watchdog/       # 데드맨 스위치 (Vercel Cron)
│   │   ├── stat/                   # 통계 beacon
│   │   └── og/[id]/                # OG 카드
│   └── (feeds)/                    # RSS·sitemap Route Handler
├── middleware.ts                   # 호스트 분기 (root→hub / dev.→dev / faith.→faith)
├── components/
│   ├── ui/                         # shadcn (스타일 오버라이드만)
│   ├── record/                     # RecordCard, DividerTabs, ScriptureBlock, AnnotationBox …
│   ├── hub/                        # 허브 랜딩 — HubScene(장면) + HubStage(연출 아일랜드 1개, ADR-004)
│   └── editor/                     # EditorToolbar, SectionBlock, SaveIndicator …
├── lib/
│   ├── content/                    # Zod: PostContent union, Draft/Publish 스키마
│   ├── render/                     # renderRichText 노드 매퍼, 타입별 뷰 로직
│   ├── db/                         # Prisma client + repositories (Json 경계 — §아래)
│   ├── actions/                    # Server Actions (withAdmin, publishPost, upsertDraft …)
│   ├── revalidate/                 # 태그 체계 헬퍼 (tag:{site}:{name} 등)
│   └── auth/
├── prisma/{schema.prisma,migrations/}
├── scripts/
│   ├── crawler/{...,fixtures/}     # 365qt 크롤러 (Actions 실행) + fixture HTML
│   ├── migrate-tistory/            # 마이그레이션 파서 + dry-run
│   └── content-migrations/         # JSONB 스키마 backfill (docs/05 §1.6)
├── .github/workflows/              # ci(PR) / crawler / db-backup / reminder cron
├── docs/                           # 기획 문서 (진실의 원천) — git에 없다. 위 §문서 경고 참고
├── vercel.json                     # watchdog cron 등록
├── AGENTS.md   CLAUDE.md
```

**경계 규칙**:
- **`lib/db` 리포지토리 밖으로 Prisma `Json` 원시 타입을 노출하지 않는다.** 경계에서 Zod `safeParse → z.infer`로 타입 붙은 값만 반환(ADR-002).
- 모든 변경 Server Action은 `lib/actions`에 모으고 **`withAdmin` 래퍼를 첫 줄에서** 통과(`docs/05` §3.2).
- content 스키마는 `lib/content` 한 곳. 저장/발행/렌더링이 같은 스키마를 참조.

## 코딩 컨벤션

- **UI 텍스트 = 한국어. 코드(변수/함수/타입/파일)·주석 언어 = 영어 코드 + 한국어 주석 허용**(커밋 본문 한글과 일관)
- **화면 문구는 `docs/03` §7 문구 규약을 따른다** — 어조는 해요체(버튼·라벨은 명사형), 용어는 사전대로(글/기록, 없애는 행위는 `삭제` 하나), 구현 용어(비콘·표본·집계)와 문서 절 번호는 화면에 쓰지 않는다
- 네이밍: 컴포넌트·타입 `PascalCase`, 변수·함수 `camelCase`, 라우트 폴더 `lowercase`, 유틸 파일 `camelCase.ts`
- **서버 컴포넌트 우선. `"use client"`는 인터랙션 필요 시에만 최소.** 공개 페이지 클라이언트 아일랜드는 **UI 7개 + 그리지 않는 것 2개**로 제한(`docs/04` §3.6) — UI 7개(코드 복사·TOC 하이라이트·YouTube lite·다크모드 토글·상세의 관리 컨트롤·감춘 묵상 덩이·**허브 연출**) + **그리지 않는 것 2개**(통계 비콘·테마 공급자)
  - **숫자는 `lib/site/clientIslands.test.ts`가 잠근다.** 늘어도 줄어도 실패한다 — 늘릴 때는 ADR을 먼저 쓴다(허브 연출은 ADR-004가 그 물음이었다). 한때 세 문서가 서로 다른 숫자를 적고 있었고, 그때 고친 것은 문장뿐이라 또 어긋났다
- **타입별 content는 반드시 Zod를 거쳐 검증 후 저장/렌더링.** raw JSON 직접 조립 금지
- path alias `@/` 사용. import는 외부→내부 순 정렬
- 상태의 원천은 RHF 폼 1개, Tiptap은 입력 위젯(Controller 연결, `docs/04` §2.1)

## 커밋 & 브랜치 규칙

- **Conventional Commits: 제목은 영문 소문자, 본문은 한글**
  - 예: `feat: add praise section block editor` + 한글 본문 설명
- **Claude 서명/어트리뷰션 푸터 금지** (`Co-Authored-By` 등 넣지 않는다)
- **main에서 직접 작업 금지. feature 브랜치 생성** — `feat/`·`fix/`·`chore/` prefix
- 하나의 커밋 = 하나의 논리적 변경. 여러 줄 본문은 HEREDOC
- (Claude Code) 커밋 컨벤션 스킬을 따른다 — `CLAUDE.md` 참조

### PR 서식 (2026-09-07 정본화)

**제목은 커밋과 같은 규칙이다** — Conventional Commits, 영문 소문자. 한글 제목을 쓰지 않는다.
브랜치의 커밋이 하나면 그 제목을 그대로 쓴다.

**본문은 한글이고 `##` 뼈대가 고정이다.** 다섯 절 중 앞 넷은 필수, `남은 것`은 있을 때만 쓴다.
순서를 바꾸지 않는다 — 어느 PR을 열어도 같은 자리에서 같은 것을 찾을 수 있어야 한다.

```markdown
## 무엇을
한두 문장. 무엇이 달라지는가.

## 왜
무엇이 문제였나 · 왜 지금인가. 측정한 값이 있으면 여기 적는다.

## 핵심 결정
왜 그 선택인가. 갈래가 여럿이면 `###`로 나눈다 — **`###` 제목은 자유다.**
"안 한 것"과 그 이유도 여기 적는다.

## 검증
테스트 수·`npm run build` 통과 여부. 새로 고정한 테스트가 무엇인가.
**사람이 브라우저로 봐야 하는 것은 반드시 여기 적는다.**

## 남은 것
머지 후에 할 일, 일부러 뺀 것. 없으면 절 자체를 넣지 않는다.
```

`##`는 이 다섯 개뿐이다. 서술형 제목(`왜 가사 섹션은 되고 묵상은 안 됐나`)은 `###`로 내려
해당 절 안에 둔다 — 그게 이 레포 PR의 알맹이라 없애지 않는다.

브랜치가 다른 PR 위에 쌓여 있으면 **본문 맨 위에 인용 한 줄**로 적는다(절 밖).

`.github/pull_request_template.md`가 같은 뼈대를 미리 놓는다.

## 절대 하지 말 것

- **비밀 값 하드코딩 금지** — 365qt 계정(`QT365_*`), Supabase service role key, `CRAWLER_INGEST_TOKEN`, `STAT_SALT`, Slack 웹훅 등. GitHub Actions Secrets / Vercel 환경변수만
- **크롤러에 service role key·DATABASE_URL 부여 금지.** 크롤러는 `/api/crawler/ingest` 스코프 토큰으로 **DRAFT 생성만**. revalidate 호출 금지(`docs/05` §3.3, `docs/06`)
- **크롤러 파싱 실패 시 조용히 넘어가지 말 것** — 반드시 Slack 알림. "빈 것처럼 보임"을 SKIPPED 근거로 쓰지 말 것(명시적 no-content 마커로만 SKIP, 그 외 파싱 실패는 FAILED)
- **`docs/decisions/`의 ADR과 상충되는 구현 금지**
- **supabase-js를 클라이언트에서 사용 금지** — 공개 읽기는 서버 Prisma 정적 렌더 전담(`docs/05` §3.1)
- **공개 쿼리는 `status = PUBLISHED` 강제.** DRAFT/PRIVATE가 공개 경로로 새지 않게
- 요청받지 않은 대규모 리팩토링 금지 (제안 가능, 실행은 승인 후)
- **마이그레이션 파일 수동 편집 금지** (Prisma migrate 사용). JSONB content 구조 변경은 `scripts/content-migrations/` backfill 규약(`docs/05` §1.6)
  - **예외 하나 — `Post_searchText_trgm_idx`.** 검색 GIN 인덱스는 `schema.prisma`가 표현하지 못하는 종류라,
    스키마를 바꿀 때마다 Prisma가 생성된 `migration.sql`에 `DROP INDEX "Post_searchText_trgm_idx"`를 끼워 넣는다.
    **그 줄은 손으로 뺀다**(`docs/05` §4A). 한 번 놓치면 검색이 깨지는 게 아니라 조용히 느려져서 늦게 발견된다.
    이 함정은 지금 사람의 기억에만 있었다 — 규칙과 현실이 반대인 채로 두지 않는다.

## 검증 방법

- **빌드 통과(`npm run build`)가 커밋 전 필수**
- **단위 테스트(Vitest) 필수 대상**:
  - 크롤러 파서 — **fixture HTML 기반**(정상 / 주석0 / 마크업변경=실패기대 최소 3종). `--dry-run` + fixture 통과가 커밋 조건(`docs/06` §6)
  - 마이그레이션 타입별 컨버터 — 티스토리 HTML fixture 기반
  - Zod Draft/Publish 검증 + 렌더링 전 safeParse 폴백
  - 청구기호 부여 트랜잭션 — 멱등·동시성
    - **이 문장이 실제로 덮는 범위**: 테스트는 가짜 클라이언트로 `upsert` 인자가 `increment`인지를 본다.
      **진짜 트랜잭션 격리는 보지 않는다** — 그 호출이 트랜잭션 안에 있는지도 눈으로 확인해야 한다(있다).
      1인 서비스에서 동시 발행은 사실상 없으므로 그대로 둔다(2026-09-19 판단).
- **E2E는 핵심 플로우만**(과잉 금지, 1인 서비스): 설교 무손실(네트워크 차단 시나리오), 자동 저장 복구 배너
  - **2026-09-12 현실 정정 — 자동 E2E는 아직 0건이다.** 그때까지 아래 손 체크리스트가 그 자리를 대신한다.
    jsdom은 이 결함을 못 잡는다: `lib/editor/useEditorAutosave.ts:112` 주석이 그중 하나를 적고 있다
    ("StrictMode… 실제로 브라우저에서 저장이 한 번도 나가지 않는 버그였다").

### 설교 무손실 손 체크리스트 (에디터를 만진 PR은 머지 전 · 5분)

> 지키려는 것은 프리모템 #2다 — **설교는 로컬이 진실의 원천**이고 서버는 백그라운드 백업이다
> (`lib/editor/localMirror.ts`). 서버가 죽어도 글이 살아 있어야 한다. 초록 테스트는 이것을 증명하지 않는다.

`/admin/write/sermon`에서:

1. **저장이 실제로 나가는가** — 몇 글자 치고 DevTools Network에 요청이 뜨는지. 뜨지 않으면 여기서 멈춘다
2. **네트워크를 끊고 계속 쓴다** (DevTools → Offline) — 글이 계속 써지고, 표시가 `로컬 저장됨 · 동기화 대기`가 되는가.
   입력이 막히거나 모달이 뜨면 **실패**다(ADR-001 §5 — 방해 요소 제로)
3. **네트워크를 되살린다** — 동기화가 저절로 따라잡는가
4. **탭을 닫았다 다시 들어간다** — 친 글자가 그대로 있는가.
   여기가 **로컬 스냅샷이 페이지 해체를 견디는지** 보는 자리다
5. **복구 배너** — 서버에 안 올라간 스냅샷이 있는 상태로 다시 들어가면 배너가 뜨고,
   `복원`이 로컬 값을, `무시`가 서버 값을 남기는가. **조용히 덮어쓰면 실패다**
6. **발행까지 한 번** — 발행 뒤 공개 지면에서 글이 온전한가

한 줄이라도 어긋나면 PR 본문 `검증`에 적는다. 다 통과하면 날짜와 커밋 해시를 적는다.

> **오프라인에서 새로고침하면 화면이 안 뜬다 — 정상이다.** 서비스 워커가 없으므로 브라우저가
> HTML 문서 자체를 못 받아온다. 한동안 3번이 "끊긴 채로 새로고침"이었는데, 그건 이 불변식이
> 아니라 **오프라인 셸**을 묻는 항목이었다(2026-09-13 실측에서 드러났다).
>
> **그래서 남는 위험 하나**: 오프라인 중에 탭이 죽으면 **온라인이 될 때까지 이어 쓸 수 없다.**
> 글자는 localStorage에 살아 있지만 그 화면에 닿지 못한다. 막으려면 오프라인 셸(서비스 워커)이
> 필요한데 **2026-09-19에 하지 않기로 정했다** — 한 번 붙이면 되돌리기 어렵고(캐시 전략·버전·낡은 셸),
> 걸리는 경우가 "예배 중 오프라인 상태에서 탭이 죽는" 드문 겹침이다. **알고 받아들인 대가**다.

**2026-09-13 실측 — 통과.** 프로덕션(`kwangilkim.com/admin/write/sermon`)에서 돌았다.
저장이 나가고(디바운스), 끊은 채로 계속 써지며 `로컬 저장됨 · 서버 저장 대기`가 뜨고,
되살리니 동기화가 따라잡았고, 복구 배너가 떴고, 발행까지 온전했다.
- 크롤러 변경 시: dry-run 모드로 파싱 결과 6질문·4그룹 검증
- **CI (자동 게이트)**: PR에 typecheck + Biome 린트 + Vitest + `build`를 GitHub Actions로 강제(크롤러 워크플로우와 별개). 초록 아니면 머지 금지
- **commitlint + husky**: commit-msg 훅으로 커밋 규칙(Conventional Commits·영문 소문자 제목·서명 금지) 자동 검증, pre-commit 훅으로 Biome 실행

### 잃으면 못 되돌리는 것 (분기 1회 · 5분)

매일 도는 백업(`/api/cron/backup`)은 **DB와 같은 Supabase 프로젝트의 Storage**에 쌓인다.
그 프로젝트 하나가 날아가면 원본과 사본이 함께 날아간다. 복원 스크립트도 아직 없다.

- **분기 1회 `/admin/export`를 눌러 내려받은 파일을 그 프로젝트 밖에 둔다.** 그게 지금의 오프사이트다
- 같은 걸음에 `docs/`도 복사한다(위 §문서 경고 — 그쪽은 이력조차 없다)

백업은 `backups/db/{날짜}.json.gz`로 **일주일치만** 남는다(`KEEP_BACKUPS`). 새 백업을 올린
직후 옛것을 지우므로, 되돌릴 일이 생기면 **일주일 안에 알아채야 한다.**

- **푸는 법**: 대시보드에서 내려받아 `gunzip 2026-09-19.json.gz` — 원래 JSON이 된다.
  읽는 코드는 레포에 없다(그래서 압축이 쌌다). 23MB가 3.8MB로 줄지만 내용은 그대로다
- 한 장에 **글 전문이 통째로** 들어 있다(`posts`의 `content` + `searchText`가 96%).
  통계는 빼고 이미지는 메타데이터만 — 사진 자체는 `post-images`에 따로 있다

## 작업 스타일

- 모호한 요구는 구현 전에 질문한다. 단, 사소한 결정은 스스로 판단하고 커밋 본문에 근거를 남긴다
- 큰 작업은 계획을 먼저 제시하고 승인 후 진행한다
- 완료 보고는 간결하게: 변경 파일, 핵심 결정, 남은 일
- 현재 마일스톤의 DoD(`docs/07` §2)를 넘기는 "최소 완주"를 목표로. 개선 욕구는 "거슬림 목록"으로 미룬다(완벽주의 억제, 프리모템 #10)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
