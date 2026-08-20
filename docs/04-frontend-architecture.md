# 04. Frontend Architecture — 렌더링 전략 · 에디터 상태 · 렌더링 파이프라인

> 상태: **확정 (Phase 5 완료: 5-1 렌더링 전략 / 5-2 에디터 상태 관리 / 5-3 렌더링 파이프라인)**
> 선행 문서: `docs/00-product-vision.md`, `docs/01-user-scenarios.md`, `docs/02-information-architecture.md`, `docs/03-design-system.md`, `docs/decisions/001-editor-toolbar-model.md`
> 최종 갱신: 2026-08-18

---

## 0. 판단 기준

트래픽은 무료 티어 한도의 1% 미만 — 성능이 아니라 다음 셋이 기준이다.
① SEO: 공개 페이지는 크롤러에게 항상 완성된 HTML ② 발행 즉시 반영 ③ 무료 티어 안에서 운영 단순성

---

## 1. 렌더링 전략 (Phase 5-1)

### 1.1 페이지별 전략

| 화면 | 전략 | revalidate | 근거 |
|------|------|-----------|------|
| H-01 허브 | SSG (완전 정적) | 없음 (배포 시에만) | 내용이 안 변하는 게 스펙 |
| F-01/F-02, D-01/D-03 목록·태그 | SSG + on-demand revalidate | 태그 기반, 발행/수정/삭제 시 | 콘텐츠가 바뀌는 유일한 순간 = 내가 발행할 때 |
| F-03/D-02 상세 | SSG + on-demand revalidate | `post:{id}` | 검색 유입 주 지점, 정적 HTML 필수 |
| S-01/02 RSS·sitemap | Route Handler + 캐시 | 발행 시 함께 무효화 | 상세와 같은 이벤트에 묶임 |
| A-* 관리 전체 | 동적 (SSR/CSR 혼합) | 캐시 없음 | 인증 필요, 항상 최신 |
| 통계 수집 | Route Handler (POST beacon) | — | Day 1 수집. 렌더링과 분리 |

**원칙: 시간 기반 ISR을 쓰지 않는다.** 1인 블로그의 콘텐츠 변경은 100% 작성자 행동에서 오므로 이벤트 기반 무효화가 정확하고, 함수 호출 최소화로 무료 티어에도 최적.

### 1.2 발행 시 캐시 무효화 흐름

```
[발행/수정/삭제/PRIVATE 전환] (Server Action)
  → DB 쓰기 (Prisma)
  → revalidateTag 일괄:
      post:{id} / list:{site} / list:{site}:{type|category} / tag:{site}:{각 태그} / feed:{site}
      (태그는 site 스코프 — dev/faith 동명 태그 교차 무효화 차단. 05 §5에서 정밀화)
  → 공개 페이지로 redirect (02 문서 확정 플로우)
```

- **수정 저장 = 저장 즉시 공개 반영** (별도 "반영" 버튼 없음, 확정)
- **PRIVATE 전환 = 무효화 + 단순 404** (410 미사용, 확정)
- 크롤러(GitHub Actions)는 DRAFT만 생성 → 공개 캐시를 건드리지 않음. 크롤러 장애와 사이트 가용성이 완전 분리 (프리모템 #1 정합)

### 1.3 middleware 호스트 분기

```
host = req.headers.host
  root      → rewrite /hub/*
  faith.*   → rewrite /faith/*
  dev.*     → rewrite /dev/*
  /admin/*  → 호스트 무관, 인증 체크 (미인증 → A-00 리다이렉트)
```

- 도메인은 루트·dev·faith **3개를 Vercel에 명시 등록** (와일드카드 불사용, Hobby 플랜 안전 경로)
- 개발 중엔 `?site=` 쿼리 폴백으로 Vercel 기본 주소에서 3면 테스트

---

## 2. 에디터 상태 관리 (Phase 5-2)

### 2.1 상태 소유 구조

```
react-hook-form (에디터당 1개, zodResolver)
 ├─ 스칼라: title, scriptureRef, youtubeUrl, category, tags …
 ├─ 배열: questionGroups(answers), sections[]  → useFieldArray
 └─ 리치 필드: body(설교·기술), 답변·요약(큐티), 묵상과 기도(찬양)
     → Tiptap 인스턴스가 입력 위젯, Controller로 Tiptap JSON을 폼에 반영
```

- **진실의 원천은 RHF 폼 상태 하나.** 자동 저장·검증·더티 체크가 한 곳에서 동작
- ADR-001 공통 툴바 = "현재 포커스된 Tiptap 인스턴스"를 가리키는 컨텍스트 하나로 전 에디터 재사용

### 2.2 자동 저장 상태 기계 (전 에디터 공통)

```
idle ─입력─▶ typing ─debounce 1s (maxWait 5s)─▶ saving ─▶ saved
                                                  │실패
                                                  ▼
                                        retrying (백오프 2s→5s→10s, 더티 유지)
[임시저장 버튼] = debounce 즉시 flush (같은 파이프라인)
[발행] = flush 완료 대기 → status 전환 → revalidateTag → redirect
```

- 저장 = Server Action `upsertDraft(postId, content)`, 낙관적 처리 (즉시 "저장 중…", 실패 시에만 롤백+재시도)
- **maxWait 5s 필수** — 연속 타이핑(설교)에서 debounce가 영원히 안 터지는 문제 방지
- 저장 인디케이터 상태 매핑은 03 문서 `SaveIndicator` 참조

### 2.3 로컬 보존 2계층

| 계층 | 대상 | 방식 |
|------|------|------|
| 보험 미러 | 전 에디터 | 저장 파이프라인과 별개로 입력 즉시 localStorage `draft:{type}:{id}` 스냅샷. 서버 저장 성공 시 rev 갱신 |
| **로컬 우선** | **설교(A-05)만** | **로컬이 진실의 원천.** 키 입력 → 즉시 로컬 기록(rev++) → 서버 동기화는 background 큐. 실패해도 "로컬 저장됨 · 동기화 대기"로 정상 동작. `online` 이벤트 + 백오프로 큐 재전송 |

- 복구 UI (전 에디터): 마운트 시 `local.rev > server.rev`면 배너 "저장 안 된 내용이 있어요 → 복원 / 서버 버전 유지"
- 충돌 해소: **last-write-wins + 로컬 우대** (1인 서비스 — 동시 편집 시나리오 없음)
- **알려진 한계(설교 로컬 우선)**: localStorage는 기기 로컬이므로 설교는 **단일 기기(노트북) 전제**(01 §2.2). 예배장에서 서버 동기화 실패한 채 노트북을 닫으면 타 기기(집 데스크탑)에선 그 내용이 보이지 않는다. 크로스기기 이어쓰기는 **서버 동기화 성공 시에만** 가능 — 버그 아님, 로컬 우선의 본질적 트레이드오프
- 저장소는 localStorage (글 수십 KB ≪ 5MB). QuotaExceeded 시 타 초안의 오래된 미러부터 정리하는 가드만 추가. IndexedDB 불채택 (비용 대비 이득 없음)

### 2.4 Zod ↔ JSONB

```ts
// content = 타입별 discriminated union
const QtContent = z.object({
  scriptureRef: z.string(),
  scriptureBody: z.string(),
  annotations: z.array(z.object({ term: z.string(), verseRef: z.string().optional(), body: z.string() })),
  questionGroups: z.array(z.object({
    group: z.string(),
    questions: z.array(z.object({ label: z.string(), text: z.string(), answer: TiptapDoc })),
  })),
  summary: TiptapDoc,
});
// PraiseContent.sections: { id: string, label: enum | custom, lyrics: string }[]
```

- **스키마 2벌**: `DraftSchema`(자동 저장은 무엇이든 저장 — kind만 필수, 나머지 재귀 optional) / `PublishSchema` (구조 필수). ※ `deepPartial`은 Zod v4에서 deprecated → **커스텀 partial 유틸로 구현**(05 §2). 큐티 답변 공란은 **UI 레벨 경고만** — 발행 차단 없음 (02 문서 확정 정책이므로 스키마 refine이 아니라 UI에서 처리)
- 검증 지점 3곳: 저장 전(draft) / 발행 전(publish) / **렌더링 전(safeParse — 실패 시 raw 폴백 렌더 + Slack 알림)**. 스키마 마이그레이션 사고 방어

### 2.5 찬양 섹션 배열

- 섹션 = `{ id: nanoid, label, customLabel?, lyrics }`. **순서 = 배열 인덱스가 유일한 진실** (order 필드 없음)
- 드래그: dnd-kit `SortableContext` + `arrayMove` → `useFieldArray.move()`. 키보드 정렬(Alt+↑↓)도 같은 move
- Verse 넘버링은 렌더 시 파생 계산 (저장 안 함)
- 엔터 2회 → `append({ label: last.label })` + 포커스 이동

### 2.6 라이브러리 (락파일 고정 — 프리모템 #6)

`react-hook-form` + `@hookform/resolvers(zod)`, `@tiptap/*`, `dnd-kit`, `nanoid`

---

## 3. 렌더링 파이프라인 (Phase 5-3)

### 3.1 구조: 정본은 JSON 하나, 렌더러는 공유

```
[묵상 글]  content JSONB ──▶ 타입별 뷰 (QtView / SermonView / PraiseView)
[리치 필드] Tiptap JSON ──▶ 공용 직렬화기 renderRichText() ──▶ React 엘리먼트
             (같은 노드 순회의 출력 타깃 3종: React 렌더 / 평문 추출[검색 searchText, 05 §4A] / 마크다운 직렬화[export, 07 M3])
[기술 글]  content.body (Tiptap JSON) ──▶ 같은 renderRichText() + TOC·하이라이팅
```

- **MDX 불채택 (확정).** 정본이 Tiptap JSON이므로(5-2) 기술 글도 같은 직렬화기를 탄다 → 파이프라인 단일화, MDX 컴파일 의존성 제거
- 직렬화기는 `generateHTML`이 아닌 **JSON 직접 순회 노드 매퍼 자체 구현** (~100줄): 코드 블록→Shiki, 이미지→next/image, 제목→TOC 앵커를 노드 레벨에서 매핑
- 타입별 뷰는 03 문서의 조판 규칙(말씀 세로 괘, 점선 주석, 질문 그룹 칸막이 탭, 가사 섹션 라벨)을 구조 그대로 구현

### 3.2 코드 하이라이팅 — Shiki

- 서버 렌더 시점 실행 (revalidate 때 1회, 클라이언트 JS 0KB)
- 커스텀 테마: 배경 `--ink #2B2823` (먹지 위의 코드), 다크모드는 CSS variables 1벌
- 언어는 사용분만 로드 (ts/js/tsx/json/bash/sql로 시작)
- 코드 블록 UI: 언어 라벨(타자기체) + 복사 버튼 (복사 버튼만 클라이언트 아일랜드)

### 3.3 이미지

- 업로드: 에디터 붙여넣기/드롭 → Server Action → **Supabase Storage** (무료 1GB)
- 저장 시 원본 폭 기록 → `next/image` 렌더 (Vercel 이미지 최적화 무료 한도 내 여유)
- 티스토리 마이그레이션 이미지도 동일 Storage로 이관 (Phase 6 상세)

### 3.4 TOC (기술 글) — 미결 #3 해소

- 직렬화기가 h2/h3 순회하며 `{ id(slug), text, level }[]` 추출 (렌더와 같은 패스)
- **위치 확정: 데스크탑 = 우측 여백 sticky, 모바일 = 본문 상단 접이식** ("책 여백의 메모" — 기록 카드 은유 정합)
- 현재 섹션 하이라이트: IntersectionObserver (클라이언트 아일랜드)

### 3.5 OG 이미지 — 미결 #4 해소

- `@vercel/og`(satori)로 **기록 카드를 OG 사이즈(1200×630)로 재조판**
  - faith: 청구기호 + 붉은 상단 괘 + 제목(Gowun Batang) + 말씀 범위 + 하늘 괘선
  - dev: 파란 괘 + 제목 + 카테고리 메타
- Route Handler `/og/[id]`, 발행 시 같은 태그로 무효화. 폰트는 서브셋 woff 2종만 임베드
- 목록 카드 = 상세 지면 = OG 카드: 링크 공유가 곧 브랜딩. 썸네일 미지정 글의 폴백 겸용

### 3.6 클라이언트 JS 총량

공개 페이지의 클라이언트 아일랜드는 4개: **코드 복사 버튼, TOC 하이라이트, YouTube 임베드(lite 방식 — 클릭 전 썸네일만), 다크모드 토글**. 그 외는 정적 문서.

- 다크모드 = **수동 토글 + OS 기본값**(Phase 8 결정). `next-themes`로 OS 감지·수동 전환·localStorage 지속·무FOUC(첫 페인트 전 인라인 스크립트로 테마 클래스 세팅)를 처리. "밤의 서고" 다크 토큰(03 §2.1)은 구현 단계에서 실값 확정

---

## 4. 이 문서가 후속 Phase에 거는 제약

| 대상 | 제약 |
|------|------|
| 6 (BE) | content JSONB는 §2.4 스키마 구조 준수. revalidateTag 목록(§1.2)에 대응하는 태그 체계. 이미지 Storage 버킷 설계 |
| 7 (크롤러) | 크롤러는 DRAFT 생성만 — revalidate 호출 금지 (공개 캐시 불간섭 유지) |
| 8 (로드맵) | MVP에 포함: on-demand revalidate 체계, 설교 로컬 우선 저장, OG 카드, TOC. 다크모드 상세 튜닝은 구현 중 판단 |

## 5. 미결정 사항 (갱신)

| # | 항목 | 해소 예정 |
|---|------|----------|
| 1 | 브랜드명 + 도메인 + 서브도메인 명칭 | Phase 4 후속 (보류 중, 확정) |
| 2 | 다크모드 토큰 상세 튜닝 | 구현 단계 |
| 3 | 통계 수집 구현 방식 (beacon 스키마·저장 위치) | 6 |
| 4 | 티스토리 마이그레이션 범위 | 6, 8 |
| 5 | 발행 도장 마이크로 인터랙션 채택 | 구현 후 |

## 부록. Phase 5 결정 로그

1. 시간 기반 ISR 불사용 — **이벤트 기반 on-demand revalidate만** (태그 체계 §1.2)
2. 수정 저장 = 즉시 공개 반영 / PRIVATE 전환 = 단순 404
3. 진실의 원천 = RHF 폼 상태 1개, Tiptap은 입력 위젯 (Controller 연결)
4. 자동 저장 debounce 1s + **maxWait 5s**, 낙관적 저장 + 백오프 재시도
5. 로컬 보존 2계층: 전 에디터 보험 미러 + **설교만 로컬 우선(로컬 = 진실)**. localStorage 채택, IndexedDB 기각
6. Zod 스키마 2벌 (Draft deepPartial / Publish) + **렌더링 전 safeParse 3중 검증**
7. 찬양 섹션 순서 = 배열 인덱스 (order 필드 없음), dnd-kit
8. **기술 글 저장 포맷 = Tiptap JSON (00 문서 미결정 #4 해소).** 마크다운은 입력 포맷일 뿐
9. **MDX 불채택** — 묵상·기술 공용 자체 직렬화기 (~100줄 노드 매퍼)
10. Shiki 서버 사이드, 커스텀 먹지 테마
11. TOC = 데스크탑 우측 sticky / 모바일 상단 접이식 (미결 #3 해소)
12. OG = 기록 카드 재조판 `@vercel/og` (미결 #4 해소)
13. revalidate 태그 = `tag:{site}:{name}` (site 스코프) — Phase 6/ADR-002에서 정밀화 (dev/faith 동명 태그 교차 무효화 차단)
