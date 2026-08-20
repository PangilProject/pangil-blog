# 08. Launch & Dev Setup — 착수 결정 델타 · 개발 환경 세팅

> 상태: **확정 (기획 완료 후 빌드 착수 세션 — 14건 결정 + 환경 세팅)**
> 선행 문서: `docs/00`~`docs/07`, `docs/decisions/001`·`002`, `AGENTS.md`, `CLAUDE.md`
> 성격: 기존 문서를 **뒤집는 결정만** 소스에 반영(패치 완료)하고, 나머지는 이 문서에 모은다. 소스와 충돌 시 이 문서가 최신.
> 최종 갱신: 2026-08-18

---

## 1. 착수 결정 델타 (14건)

| # | 항목 | 결정 | 소스 반영 |
|---|------|------|----------|
| 1 | Supabase 환경 | 원격 **dev + prod 2개 프로젝트**(Docker 없이). 전용 구글 계정으로 가입 | §2 |
| 2 | 한글 폰트 | **전부 self-host + 서브셋** — next/font/google 3종 + Pretendard local 동적 서브셋 | §4 / AGENTS |
| 3 | 린트·포맷 | **Biome** 단독 (+ npm, Node LTS, Vitest) | AGENTS |
| 4 | faith 저작권 | **(가) 유지** — 3중 레이어(성경 번역·365qt·가사) 인지하고 전량 즉시 공개 | 05 미결 #1 (추적 유지) |
| 5 | 도메인·브랜드 | **배포 직전 결정.** 코드엔 `NEXT_PUBLIC_SITE_URL` 등 env 주입, 하드코딩 금지. 후보 pangil.me / pangil.dev | §3 / 07 §4 |
| 6 | 옛 글 접근 = **검색 MVP 승격** | Postgres `pg_trgm` + `searchText`. 작성자 1순위 경로 | 02(D-04/F-05), 05 §4A, 07 M3 |
| 7 | 다크모드 | **수동 토글 + OS 기본**(next-themes, 무FOUC). 아일랜드 3→4 | 04 §3.6 |
| 8 | 개인정보 | **최소 방침 페이지**(H-02), 통계 설계 유지 | 02 H-02 |
| 9 | 모바일 에디터 | **키보드 위 sticky 툴바**(QT 답변). 나머지 타입은 데스크탑 전제 | 02 §5.2 |
| 10 | RSS 본문 | **전 사이트 요약(발췌) + 전문 링크** | 02 S-01 |
| 11 | 이미지 alt | **권장(경고-only)** + 마이그레이션 공란 허용+리포트 | (본 문서 §5) |
| 12 | 에러/빈 상태 | **정성 세트**(기록 카드 톤 + 미세 일러스트) | 02 S-06 |
| 13 | CI | **풀 채택** — PR CI + commitlint + husky | AGENTS 검증 / §6 |
| 14 | 플랫폼 export | **마크다운 export MVP** — 전 글 `.md` 일괄(renderRichText 마크다운 타깃) | 04 §3.1, 07 M3 |

---

## 2. Supabase 환경 (결정 #1)

- **dev + prod 2개 프로젝트** (무료 티어 활성 프로젝트 2개 한도 — 가입 시 현재 한도 재확인). 전용 구글 계정으로 가입해 개인 계정과 분리.
- **마이그레이션 흐름**: dev에서 `prisma migrate dev`로 개발 → 마이그레이션 파일 커밋 → 배포 시 prod에 `prisma migrate deploy`. dev에서 깨보고 prod엔 검증된 것만.
- **이중 URL (첫날 함정)**: Prisma는 런타임 pooled URL과 마이그레이션 direct URL **둘 다** 필요.
  - `DATABASE_URL` = pooled(pgbouncer, 포트 **6543**) — 런타임 쿼리
  - `DIRECT_URL` = direct(포트 **5432**) — `prisma migrate`
  - `schema.prisma`의 `datasource`에 `url = env("DATABASE_URL")` + `directUrl = env("DIRECT_URL")`
- **각 프로젝트에 따로**: Storage 버킷 `post-images`, 관리자 계정(+MFA), `pg_trgm` 확장(`create extension if not exists pg_trgm`).
- **dev 7일 비활성 정지 주의**: prod는 크롤러 매일 쓰기로 자연 방어, **dev는 아님**. 개발 공백이 길면 대시보드에서 재개(치명적 아님).
- **크롤러(Actions)는 prod ingest만** 겨냥. dev 크롤 테스트가 필요하면 dev ingest URL을 별도 지정.

---

## 3. 도메인·브랜드 (결정 #5)

- **미구매, 배포 직전 확정**(01 §3.4, 07 §4 출시 게이트). 개발은 Vercel 기본 주소 + `?site=` 폴백으로 3면 테스트.
- **env 주입 원칙**: 실제 도메인·서브도메인을 코드에 하드코딩하지 않는다. `NEXT_PUBLIC_SITE_URL`(루트), 서브도메인 매핑도 env/설정으로. 도메인 확정 시 env만 교체.
- 브랜드 **표시명**(UI/OG)은 도메인과 별개 — 03 시안의 "믿음의 기록 / 개발의 기록"을 가칭 유지, 나중에 확정.
- 후보: pangil.me(허브 중립·이력서 주소) / pangil.dev(개발자색, 서브는 tech./faith.). 등록기관은 Cloudflare Registrar(원가) 등.

---

## 4. 한글 폰트 로딩 (결정 #2)

- **`next/font/google`**(빌드 시 self-host + unicode-range 자동 서브셋 + 폴백 메트릭): Gowun Batang · Nanum Gothic Coding · JetBrains Mono
- **`next/font/local`**: Pretendard — 블로그 본문은 임의 한글이 오므로 "쓴 글자만 서브셋"이 불가 → Pretendard **동적 서브셋(unicode-range 분할 woff2)** 사용, 페이지별 필요 범위만 로드
- 네 폰트를 CSS 변수로 노출 → Tailwind 테마 + 03 역할 토큰(본문 Pretendard / 세리프 Gowun Batang / 타자기 Nanum Gothic Coding / 코드 JetBrains Mono)에 매핑. `display: swap`
- 임계 폰트(본문 Pretendard·세리프 Gowun)만 preload, 코드·메타 폰트는 필요 시 로드
- 외부 런타임 의존 0 (next/font는 Google 폰트도 빌드 시 self-host)

---

## 5. 이미지 alt / 접근성 (결정 #11)

- **신규 이미지 = 권장(경고-only)**: 업로드 시 alt 필드 노출, 비면 발행 시 UI 경고만(발행 차단 없음 — QT 답변 공란 정책과 일관, 02 §6)
- **마이그레이션 이미지 = 공란 허용 + 리포트 목록화**(추후 유입 많은 글부터 보강)
- 일반 a11y: 시맨틱 마크업·키보드 포커스·대비(먹/종이 토큰 양호)는 M1/M3 기본 준수. `prefers-reduced-motion`은 이미 반영(03 §4)

---

## 6. CI / commitlint (결정 #13)

- **PR CI**(`.github/workflows/ci.yml`): typecheck + Biome 린트 + Vitest + `npm run build`. 초록 아니면 머지 금지. 크롤러/백업/리마인드 워크플로우와 별개.
- **commitlint + husky**: commit-msg 훅 = Conventional Commits + 영문 소문자 제목 + 서명 금지 검증. pre-commit 훅 = Biome.
- 목적: 사람이든 Claude Code든 규칙 드리프트를 자동 차단(프리모템 #6 정합).

---

## 7. MVP 편입 요약 (이 세션으로 늘어난 범위)

M3에 추가된 것: **검색(pg_trgm)**, **마크다운 export**, **다크모드 수동 토글**, 개인정보처리방침 페이지, 에러/빈 상태 정성 세트.
공통 재사용: renderRichText 노드 순회가 **React 렌더 / 평문(검색) / 마크다운(export)** 3-타깃을 공유 → 추가 범위 대비 한계비용 낮음.

---

## 8. `.env.example` (전 시크릿 인벤토리)

레포 루트 `.env.example` 참조(별도 파일). 실제 값은 dev는 로컬 `.env`, prod는 Vercel 환경변수, 크롤러는 GitHub Actions Secrets에만. **하드코딩·커밋 금지**(AGENTS "절대 하지 말 것").

---

## 9. 미결정 (이 문서 기준 잔여)

| # | 항목 | 해소 |
|---|------|------|
| 1 | 도메인·브랜드명·표시명 확정 | 배포 직전 |
| 2 | 티스토리 파서 / 365qt 로그인 셀렉터 | 구현 착수(실물) |
| 3 | faith 저작권 정책 최종 입장(레버 상존) | 필요 시 |
| 4 | 다크 토큰 실값 튜닝 | M3/M6 |
| 5 | md export 프론트매터 필드 확정 | M3 구현 |

---

## 부록. 소스 문서 패치 이력 (이 세션)

- **02**: D-04/F-05 검색, H-02 개인정보처리방침, S-06 에러/빈 상태, S-01 RSS 요약+링크, A-07 고정 툴바, §5.2 모바일 sticky 툴바, §2.6에서 전문 검색 제거
- **04**: §3.1 renderRichText 3-타깃, §3.6 아일랜드 3→4 + 다크 토글(next-themes), (9-2) 태그 site 스코프·deepPartial·설교 크로스기기
- **05**: Post.searchText + pg_trgm, §4A 검색 섹션, 수용 #4·후속제약·결정로그의 searchText Backlog→MVP
- **07**: M3에 검색·md export·다크 토글·H-02 편입, Backlog #4 검색 제거, §1 제외목록에서 검색 삭제
- **AGENTS**: 08 읽기 순서, next-themes·pg_trgm 의존성, CI/commitlint/husky, ci 워크플로우
