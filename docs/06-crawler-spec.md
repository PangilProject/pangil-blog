# 06. Crawler & Automation — 365qt 크롤러 명세 · 자동화 확장

> 상태: **확정 (Phase 7 완료: 7-1 크롤러 상세 명세 / 7-2 자동화 확장)**
> 선행 문서: `docs/00-product-vision.md`, `docs/01-user-scenarios.md`, `docs/02-information-architecture.md`, `docs/04-frontend-architecture.md`, `docs/05-backend-and-data.md`, `docs/decisions/002-jsonb-vs-tables.md`
> 최종 갱신: 2026-08-18

---

## 0. 판단 기준 · 원칙

- **크롤러는 "옮겨 적기" 자동화만 한다.** 365qt 본문·질문 타이핑은 사무 노동 → 자동화(00 §7-1). 반대로 찬양 가사·묵상 답변은 묵상 행위 그 자체 → **자동화 금지**(01 §1). 크롤러가 채우는 것은 **QT 템플릿(본문·주석·질문)뿐이고, 답변·요약은 항상 빈칸**으로 둔다.
- **크롤러는 최대 가치이자 단일 장애점**(00 §7-1, 프리모템 #1 최상 치명도). 따라서 이 문서의 절반은 파싱이 아니라 **실패를 시끄럽게 만드는 설계**다.
- **크롤러 장애 ≠ 사이트 장애.** 크롤러는 DRAFT만 생성하고 공개 캐시를 건드리지 않는다(04 §1.2·§4, 05 §3.3). 크롤러가 죽어도 블로그는 멀쩡하고, 수동 폴백으로 티스토리보다 나은 상태를 유지한다.
- 대상은 **QT만.** 설교는 예배 중 라이브 작성, 찬양은 매일 밤 수동. 크롤러는 월~토 QT 초안만 자동 생성한다(자동화 대상 아님을 명시).

---

## 1. 아키텍처 — 크롤링은 Actions, 수신은 ingest, 3층 방어

### 1.1 역할 분리

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  GitHub Actions (매일 크론)  │        │   Next.js / Vercel (앱)        │
│  · 365qt 로그인·페치·파싱     │──POST─▶│  POST /api/crawler/ingest      │
│  · 검증 → outcome 판정        │ Bearer │   (스코프 토큰, DRAFT 쓰기 전용)│
│  · 자격증명은 Actions Secrets │ token  │  GET  /api/crawler/watchdog    │
└─────────────────────────────┘        │   (Vercel 크론 데드맨 스위치)   │
                                        └──────────────────────────────┘
```

**크롤링 주체 = GitHub Actions.** 근거:
- 365qt 자격증명(`QT365_ID`/`QT365_PW`)이 앱·Vercel에 절대 안 들어간다 — Actions Secrets에만.
- Node 런타임에서 로그인 세션·헤드리스가 자유롭다(Vercel 함수 10s 타임아웃·콜드스타트 제약 회피).
- 크롤러 실행 환경이 사이트 서빙과 물리적으로 분리 → 크롤러 장애가 사이트에 전파되지 않음(프리모템 #1 정합).

**수신 주체 = `/api/crawler/ingest`.** 05 §3.3 확정: service role key 미부여, 스코프 토큰(`CRAWLER_INGEST_TOKEN`)만. 도달 가능한 코드 경로에 revalidate 없음 → 04 §4 제약을 권한 레벨에서 물리 보장. **crawl_runs 기록과 Slack 알림을 이 서버 경로에 단일화**(AGENTS.md "파싱 실패 시 반드시 Slack" 정합, 웹훅 시크릿은 Vercel env에만).

### 1.2 3층 실패 감지

| 층 | 감지 대상 | 수단 |
|----|----------|------|
| ① ingest 보고 | 로그인/파싱/검증/네트워크 실패를 **Actions가 잡은 경우** | Actions가 outcome=FAILED/SKIPPED를 ingest에 보고 → 서버가 crawl_runs 기록 + Slack |
| ② watchdog | **Actions가 아예 안 돌거나 보고조차 못 한 경우**(스케줄 비활성·러너 크래시) | Vercel 일일 크론이 "오늘 crawl_runs 없음"을 감지 → Slack (§5) |
| ③ 수동 폴백 | 위 알림을 받은 사람이 오늘 QT를 놓치지 않게 | A-01 "빈 QT 템플릿 새로 시작" 1탭 (02 §3.2, 03 StateStamp) |

① 없이 ②만으로도 사망은 잡히지만, ①이 있으면 **당일 즉시·원인 포함** 알림이 온다. ②는 "①조차 발화 못 한" 최악을 덮는 그물.

---

## 2. 크롤러 플로우 (GitHub Actions, 의사코드)

```
job crawl-qt:   # schedule + workflow_dispatch(수동 재실행)
  runDate = todayKST()                          # Actions는 UTC → KST(UTC+9, DST 없음) 변환
  try:
    session = login(QT365_ID, QT365_PW)         # 실패 유형 구분: 인증오류 vs 일시 네트워크
    html    = fetchTodayQt(session)
    if hasNoContentMarker(html):                 # ⚠ 365qt의 명시적 "오늘 콘텐츠 없음" 마커로만 판정
        report(runDate, SKIPPED, reason="no-content"); exit 0
        # "본문이 비어 보임"을 SKIP 근거로 쓰지 않는다 — 마크업 변경으로 못 찾은 것일 수 있음.
        # 마커 없이 파싱이 실패하면 아래 parse/validate에서 FAILED로 시끄럽게 떨어진다.
    parsed  = parse(html)                        # → { scriptureRef, scriptureBody, annotations[], questionGroups[] }
    assertValid(parsed)                          # §6 검증 규칙. 실패 시 throw ParseError
    report(runDate, SUCCESS, parsed)             # → ingest
    exit 0
  catch AuthError as e:  report(runDate, FAILED, stage="login", e); exit 1   # 재시도 안 함
  catch NetworkError:    retry(2s→5s→10s); 최종 실패 시 report(FAILED, stage="fetch"); exit 1
  catch ParseError as e: report(runDate, FAILED, stage="parse", detail=e); exit 1
  catch IngestError:     retry(2s→5s→10s); 최종 실패 시 exit 1                 # watchdog가 커버(§5)

report(runDate, outcome, payload):
  POST {INGEST_URL}/api/crawler/ingest
    headers: Authorization: Bearer {CRAWLER_INGEST_TOKEN}
    body:    { runDate, outcome, ...payload }
```

- **로그인 방식(폼 POST + 쿠키 vs 헤드리스 브라우저)은 실제 365qt 로그인 페이지 확인 후 확정.** 가벼운 폼 POST(undici 쿠키 처리)를 우선 시도, JS 게이트면 Playwright 폴백. → §10 미결.
- 파서가 채우는 것: `questionGroups[].questions[].text`(질문 원문), `scriptureRef/Body`, `annotations`. **`answer`·`summary`는 빈 `TiptapDoc`**(사용자 몫).
- `--dry-run` 플래그: 로그인·파싱·검증까지 하고 결과를 출력, **ingest POST는 생략**(AGENTS.md "dry-run으로 6질문 검증"). fixture HTML 기반 단위 테스트도 같은 파서 함수 사용(AGENTS.md 필수).

---

## 3. ingest 엔드포인트 (Vercel Route Handler, 의사코드)

```
POST /api/crawler/ingest
  if !constantTimeEq(bearer, CRAWLER_INGEST_TOKEN): return 401
  body = CrawlIngestSchema.parse(req)            # 신뢰 경계 — Actions 검증을 재검증(6·4 규칙 포함)

  switch body.outcome:
    case FAILED:
      crawl_runs.upsert({ runDate, status:FAILED, errorMessage:body.detail })
      slack(`🔴 QT 크롤러 실패 · ${runDate} · ${body.stage} · ${body.detail}`)
      return 200
    case SKIPPED:
      crawl_runs.upsert({ runDate, status:SKIPPED })
      slack.quiet?(`⚪ QT 미게시 · ${runDate}`)   # 소음 최소화(선택)
      return 200
    case SUCCESS:
      tx:
        run = crawl_runs.upsert({ runDate })       # runDate @@unique → 멱등
        draft = run.postId ? posts.find(run.postId) : null
        if draft && isUserEdited(draft):           # 답변/요약에 내용 있음 = 사용자 작업물
            run.update({ status:SUCCESS, note:"skip-overwrite" })
            return 200 { action:"skipped" }         # 사용자 작업 절대 덮지 않음
        content = buildQtContent(body.parsed)       # 답변·요약은 빈칸 유지
        post = draft
          ? posts.update(draft.id, { content })     # 미편집 초안 갱신(신선한 재크롤)
          : posts.create({ type:QT, status:DRAFT, content })
        run.update({ status:SUCCESS, postId:post.id,
                     questionCount:6, annotationCount:body.parsed.annotations.length })
      # revalidate 호출 없음 (DRAFT는 공개 캐시 무관 — 04 §4)
      slack.quiet?(`🟢 QT 초안 생성 · ${runDate} · ${scriptureRef} · 질문6·주석${n}`)
      return 200 { action: draft ? "replaced" : "created" }
```

- **멱등**: `crawl_runs.runDate @@unique` + upsert → 중복 트리거·수동 재실행 무해(05 §1.4).
- **사용자 작업 보호(`isUserEdited`)**: DRAFT의 `questionGroups[].answer` 또는 `summary`에 비어있지 않은 내용이 하나라도 있으면 편집됨으로 판정 → 재크롤이 덮어쓰지 않음. `updatedAt>createdAt` 같은 시간 신호보다 **내용 신호가 안전**(자동 저장이 시각만 바꾸는 오탐 방지).
- `buildQtContent` = 05 §2 `QtContent`로 조립 후 저장 전 Zod 통과.

---

## 4. 실패 모드 · 재시도 (02 §6, AGENTS.md 정합)

| 모드 | 감지 | 재시도 | 결과 |
|------|------|--------|------|
| 로그인 인증 실패(잘못된 자격증명) | 로그인 응답/리다이렉트 | ✗ (재시도 무의미) | FAILED(login) 즉시 보고·Slack |
| 로그인 일시 실패(네트워크·5xx) | 예외 | 2s→5s→10s | 최종 실패 시 FAILED(login) |
| 마크업 변경(파서 깨짐) | §6 검증 위반 | ✗ | FAILED(parse) + detail(추출 개수 등) → 빠른 인지 |
| 휴일·미게시 | **명시적 no-content 마커만** (빈 본문은 근거 아님) | ✗ | SKIPPED(정상 종료) |
| 마커 없는 빈/깨진 본문 | §6 검증 위반 | ✗ | **FAILED(parse)** — SKIP으로 삼키지 않음 |
| 중복 실행 | runDate 멱등 | — | 미편집 초안 갱신 / 편집분 skip-overwrite |
| ingest 도달 실패 | POST non-2xx/타임아웃 | 2s→5s→10s | 최종 실패 시 exit 1 → **watchdog가 당일 커버(§5)** |

핵심: **파서가 6질문이 아니면 DRAFT를 만들지 않고 FAILED로 시끄럽게 실패**한다. 조용히 5질문짜리 깨진 초안을 만드는 것이 가장 위험(02 §6 "파싱 결과 검증 규칙").

---

## 5. 데드맨 스위치 — watchdog (Vercel 크론)

Actions 스케줄은 **레포 비활성 시 자동 비활성화**되고 고부하 시 지연될 수 있어, "실패"가 아니라 **"아예 안 돎"** 이 프리모템 #1의 최악 형태다. Slack 실패 알림(①)은 이걸 못 잡는다. → 앱 쪽 감시자로 덮는다.

```
vercel.json: { "crons": [{ "path": "/api/crawler/watchdog", "schedule": "0 2 * * *" }] }
             # UTC 02:00 = KST 11:00 (크롤 창 KST 06시대 이후 충분한 여유)

GET /api/crawler/watchdog
  if bearer !== CRON_SECRET: return 401           # Vercel 자동 주입 헤더
  today = todayKST()
  if isSunday(today): return 200                   # 일요일은 QT 없음(SKIP 정상)
  run = crawl_runs.find(today)
  if !run || run.status === FAILED:
      slack(`🚨 QT 크롤러 미완료 · ${today} · ${run?.status ?? "실행 흔적 없음"} · 수동 폴백 필요`)
  return 200
```

- **무료 티어 정합**: Hobby 크론 = 하루 1회·시(hour) 내 임의 실행·UTC — watchdog는 하루 1회면 충분하고 분 단위 정밀도 불필요하므로 제약과 완전히 부합. 크론 개수도 넉넉(프로젝트당 100). **외부 서비스(healthchecks.io 등) 없이 기존 인프라(Vercel+DB+Slack)만으로 데드맨 스위치 완성** → 프리모템 #6(의존성 최소화) 준수.
- Actions 스케줄이 60일 비활성으로 꺼진 경우의 대응: watchdog 알림 수신 → 워크플로우 재활성화(1클릭) 또는 커밋 1회. 그 사이는 수동 폴백으로 공백 없음.

---

## 6. 파싱 검증 규칙 (early-warning)

`assertValid(parsed)` — 하나라도 위반 시 FAILED:

- `questionGroups.flatMap(q).length === 6`
- `questionGroups.length === 4` (내용관찰 / 연구와 묵상 / 느낀 점 / 결단과 적용 — 라벨 집합 일치 권장)
- `scriptureRef`·`scriptureBody` 비어있지 않음
- `annotations.length >= 0` (0 허용 — 주석 없는 날 정상)
- 각 `question.text` 비어있지 않음

fixture 기반 단위 테스트 필수(AGENTS.md): 정상 HTML·주석0 HTML·마크업변경 HTML(실패 기대) 세 픽스처 최소. 크롤러 변경 시 `--dry-run` + 픽스처 통과가 커밋 조건.

---

## 7. 스케줄 · 멱등 · 수동 폴백

- **스케줄: 매일 1회 실행 + 콘텐츠 없는 날 SKIPPED 처리.** 요일별 크론(월~토) 대신 매일 돌리고 일요일/휴일을 SKIPPED로 흡수 — KST↔UTC 요일 시프트·엣지 회피(KST는 DST 없어 UTC+9 고정). 크롤 시각 예: UTC 21:00(=KST 06:00).
- **멱등**: runDate 유니크 upsert(§3). `workflow_dispatch` 수동 재실행 안전.
- **수동 폴백**: 크롤러 실패/미실행 시 A-01 대시보드가 `crawl_runs`(오늘 FAILED/부재)를 읽어 "빈 QT 템플릿 새로 시작" 카드를 노출(02 §3.2, 03 §3 StateStamp "새로 시작"/CrawlBand 실패 variant). 크롤러 없이도 1탭 진입 유지.

---

## 8. 자동화 확장 (Phase 7-2) — 가치/비용/원칙 평가

모든 아이디어는 **"옮겨 적기인가, 묵상인가"**(01 §1)를 먼저 통과해야 한다. 묵상 영역을 자동화로 대체하는 아이디어는 가치와 무관하게 후순위/기각.

| 아이디어 | 묵상 침범 | 가치 | 비용 | 우선순위 | 비고 |
|----------|:--------:|:----:|:----:|:--------:|------|
| **찬양 제목 자동 제안**(YouTube→oEmbed) | 무침범 | 상 | 저 | **MVP(이미 확정)** | 00 §7-4. 신규 아이디어 아님 — 스코프 내 |
| **DB 정기 백업 export** | 무침범 | 상 | 저 | **상** | Vercel 크론 → Supabase 덤프/API → Storage or GitHub. 데이터 소실 방어(프리모템). watchdog와 같은 크론 패턴 재사용 |
| **미작성일 리마인드**(Slack) | 무침범 | 중상 | 저 | **상** | 저녁까지 오늘 글 없으면 알림. watchdog 인프라(크론+crawl_runs/posts 조회+Slack) 재사용. 스트릭 유지 동기 |
| **검색엔진 자동 제출**(sitemap/RSS ping, 구글·네이버) | 무침범 | 중상 | 중 | **중상** | 발행 시 트리거. SEO 인프라 MVP(00 §7-7)와 정합. 네이버/구글 인덱싱 API 연동 |
| **크롤러 주간 가동률 요약**(Slack) | 무침범 | 중 | 저 | 중 | crawl_runs 집계 주 1회. 신뢰(00 §4.1 가동률 지표)의 가시화 |
| **연속 작성 스트릭 표시** | 무침범 | 중 | 저 | 중 | posts 집계. 03 §5.1 "이번 달 N장·통산 N장"의 확장. 게이미피케이션(00 §5.2 Backlog 3) |
| **주간/월간 묵상 자동 요약** | **침범 위험** | 중 | 상 | 하(Backlog) | 자동 요약이 "내 묵상"을 대체할 위험. **"내가 쓴 글 모아 보여주기"로 한정**하면 안전. LLM 비용·품질 부담 |
| 이미지/링크 무결성 정기 점검 | 무침범 | 중 | 중 | 하 | 마이그레이션 이후 깨진 이미지 탐지(05 §6.6 후속) |

**MVP 편입 권고**: DB 백업 · 미작성일 리마인드는 watchdog와 동일 크론 인프라라 한계비용이 낮고 프리모템 방어에 직결 → 크롤러 MVP에 함께 태운다. 검색엔진 제출은 SEO MVP(00 §7-7) 일부. 스트릭·자동 요약·무결성 점검은 Backlog.

---

## 9. 이 문서가 후속 Phase에 거는 제약

| 대상 | 제약 |
|------|------|
| 8 (로드맵) | MVP: QT 크롤러 + ingest + watchdog + 수동 폴백. MVP 편입: DB 백업, 미작성일 리마인드, 검색엔진 제출. Backlog: 스트릭, 자동 요약(묵상 침범 주의), 무결성 점검, 크롤러 주간 요약 |
| 구현 | 자격증명은 Actions Secrets, ingest·watchdog 토큰은 Vercel env. 파서는 fixture 단위 테스트 + `--dry-run`이 커밋 조건. `isUserEdited` 보호 로직 필수. Slack은 서버(ingest/watchdog)에 단일화 |

---

## 10. 미결정 사항

| # | 항목 | 해소 예정 |
|---|------|----------|
| 1 | 365qt 로그인 방식(폼 POST vs 헤드리스) · 오늘의 큐티 페이지 URL·마크업 셀렉터 | 구현 착수(실제 페이지 확인) |
| 2 | no-content(휴일/미게시) 감지 마커 구체값 | 구현 착수 |
| 3 | 크롤 시각 확정(365qt 갱신 시각 대비 여유) | 구현 착수 |
| 4 | DB 백업 저장 위치(Supabase Storage vs GitHub) · 주기 | 8 or 구현 |
| 5 | 검색엔진 제출 채널(구글 Indexing API·네이버 서치어드바이저) 범위 | 8 |
| 6 | 미작성일 리마인드 시각·조건(글 타입별) | 구현 |

---

## 부록. Phase 7 결정 로그

1. 크롤링 = GitHub Actions(자격증명 격리·환경 분리), 수신 = `/api/crawler/ingest` 스코프 토큰(DRAFT 전용, revalidate 없음)
2. 3층 실패 감지: ① ingest outcome 보고 → 서버 Slack ② watchdog(Vercel 크론) → "미실행" 감지 ③ 수동 폴백(A-01)
3. crawl_runs 기록·Slack을 **서버(ingest/watchdog)에 단일화**, Actions는 outcome 보고만 (웹훅 시크릿 Vercel env 한정)
4. 멱등 = runDate 유니크 upsert. 재실행·수동 트리거 안전
5. **사용자 작업 보호**: 답변/요약에 내용 있으면 재크롤이 덮지 않음(내용 신호 기반)
6. 파싱 검증(6질문·4그룹·본문·주석0허용) 위반 시 DRAFT 미생성·FAILED 시끄럽게. fixture 테스트 + dry-run 커밋 조건
7. watchdog = Vercel Hobby 크론(하루 1회·시 내 실행·UTC·CRON_SECRET)으로 무료 티어·무외부의존 데드맨 스위치. 프리모템 #1·#6 동시 충족
8. 스케줄 = 매일 1회 + 콘텐츠 없는 날 SKIPPED(요일 크론 대신, KST↔UTC 엣지 회피). **SKIP은 365qt 명시적 no-content 마커로만** — "빈 것처럼 보임"은 SKIP 근거 아님(마커 없는 파싱 실패는 FAILED)
9. 대상 = QT만. 설교·찬양은 자동화 금지(묵상 노동 보호, 01 §1)
10. 자동화 확장 평가 기준 = "옮겨 적기 vs 묵상". MVP 편입: DB 백업·미작성일 리마인드·검색엔진 제출. Backlog: 스트릭·자동 요약(침범 주의)·무결성 점검
