# ADR-002. 데이터 모델: posts 단일 테이블 + JSONB content

- 상태: **채택** (2026-08-18)
- 관련 문서: `docs/02-information-architecture.md` §4·§5, `docs/04-frontend-architecture.md` §2.4·§1.2, `docs/03-design-system.md` §6.3, `docs/05-backend-and-data.md` §1~2
- 선행 ADR: 001 (에디터 모델 — 리치 필드 정본이 Tiptap JSON이라는 전제를 공유)

## 맥락

글 타입 4종(QT / SERMON / PRAISE / TECH)은 스칼라 메타(제목·상태·발행일·분류)는 공유하나 본문 구조가 완전히 다르다.

- QT: scriptureRef/Body + annotations[] + questionGroups(4그룹 6문, 각 answer는 리치 텍스트) + summary
- SERMON: scriptureRef/Body + body(리치) + summary
- PRAISE: youtubeUrl + sections[](라벨+가사) + meditationAndPrayer(리치)
- TECH: body(리치)

"타입별 테이블 분리(정규화 또는 CTI)"와 "단일 posts 테이블 + JSONB content" 중 무엇을 택할지를, 검색·인덱싱·마이그레이션 용이성·Prisma 타입 안전성, 그리고 04 문서의 Zod 3중 검증 체계와의 정합성 관점에서 논증했다.

## 결정

**`posts` 단일 테이블 + `content` JSONB(Zod discriminated union, `kind` 디스크리미네이터)를 채택한다.**

## 근거

1. **전 화면의 쿼리 조건이 스칼라 컬럼으로 완결된다.** 02 문서의 전 화면(H/D/F/A/S)을 조사한 결과 DB 조건절에 오는 것은 `type / status / publishedAt / category / tag / id`뿐이다. content 내부를 WHERE에 쓰는 화면이 없다(F-01 카드조차 타입 배지+제목+날짜뿐, scriptureRef도 목록에 없음). content 내부가 읽히는 순간은 상세/OG 렌더링뿐이고 그때는 행 전체를 가져온다.
2. **리치 필드는 분리해도 JSONB로 남는다.** answers·설교 body·summary·meditationAndPrayer는 Tiptap JSON이다(04 §2.4, 결정 로그 #8). 타입별로 분리해도 이 필드들은 각 테이블의 JSONB 컬럼이 된다. 즉 "타입별 분리"의 실체는 JSONB 제거가 아니라 JSONB를 4곳에 흩고 questionGroups/sections만 행으로 푸는 것 — 얻는 것이 스칼라 몇 개의 NOT NULL뿐이다.
3. **정규화는 자동 저장 파이프라인을 파괴한다.** 04 §2.2의 `upsertDraft(postId, content)` 한 방이 "폼 상태 ↔ 행 집합 diff(삭제 감지·순서 재배열·트랜잭션)"로 변질된다. 이걸 1초 debounce마다 수행해야 한다. 또한 04 §2.5 "찬양 섹션 순서 = 배열 인덱스가 유일한 진실(order 필드 없음)"가 뒤집힌다(행으로 풀면 order 컬럼 필수).
4. **주변 테이블의 FK 단일 지점을 유지한다.** tags·stats·청구기호·crawl_runs·assets가 모두 "글 하나"를 참조한다. 4테이블 분리 시 `(post_type, post_id)` 복합 참조(무결성 없음)를 쓰거나 공통 부모 테이블(CTI)을 되살려야 하고, 그 경우 F-01 통합 최신순 목록이 4-way JOIN이 된다.
5. **필드 스펙이 샘플 검증으로 계속 진화 중.** 02 결정 로그 #11~13(scriptureBody 추가, annotations 정체 교정, meditationAndPrayer 명명)이 보여주듯 구조가 유동적이다. 구조 진화 속도가 빠른 도메인일수록 JSONB + Zod 버전 관리의 총비용이 낮다.
6. **타입 안전성은 경계에서 회복된다.** Prisma 정적 타입도 Tiptap 본문 내부까지는 어차피 못 들어간다(어떤 스키마로도 정규화 불가). 04 §2.4에서 진실의 스키마 = Zod discriminated union으로 확정했으므로, 리포지토리 경계에서 `safeParse → z.infer`로 노출하면 애플리케이션 코드는 타입 붙은 값만 만진다. `Json`이 노출되는 층은 리포지토리 한 겹뿐. 쓰기 주체가 에디터 Server Action과 크롤러 둘뿐이고(멀티유저는 영구 Non-goal), 둘 다 Zod 게이트를 지난다.

## 수용한 반대 논거 (설계 반영)

타입별 분리 측의 유효한 지적을 다음으로 흡수했다:

1. **그림자 스키마 문제** → `contentSchemaVersion` 컬럼 + content 마이그레이션 규약(Zod 버전 분기 → `scripts/content-migrations/` backfill → 전 행 통일 후 분기 제거). safeParse 폴백(04 §2.4)은 최후 방어선 유지.
2. **DB 제약 무력화** → 발행 게이트 단일화: `publishPost` Server Action만이 status를 PUBLISHED로 전환(PublishSchema 통과 + callNumber 부여 + revalidate를 한 트랜잭션). 크롤러는 DRAFT 생성만.
3. **컬럼 승격 애매함** → 기준 명문화: *WHERE / ORDER BY / 목록 카드 / 피드에 쓰이면 컬럼, 상세 지면 전용이면 JSONB.* 현재 승격 대상 없음.
4. **전문 검색 미래 비용** → 필요 시점에 `searchText` 생성 컬럼(발행 시 Tiptap JSON → plain text 추출) + GIN을 **테이블 구조 변경 없이** 추가하는 경로를 Backlog에 명시.

## 기각한 대안

- **타입별 완전 분리 테이블**: 목록 UNION/4쿼리, polymorphic FK, 자동 저장 diff 비용, 섹션 순서 결정과 충돌.
- **posts 부모 + 타입별 확장 테이블(CTI)**: FK 문제만 해결, 조인 4벌·마이그레이션 경직성은 그대로.
- **리치 필드만 별도 테이블**: 읽기·쓰기 경로만 이원화, 이득 없음.

## 영향

- `docs/05-backend-and-data.md`: 본 결정의 ERD·스키마·제약 전개.
- `docs/04-frontend-architecture.md` §1.2: 태그 체계를 `tag:{name}` → `tag:{site}:{name}`로 갱신할 것(dev/faith 동명 태그 교차 무효화 차단, tags 테이블 `@@unique([site, name])`와 정합).
- 구현: content는 반드시 Zod를 거쳐 저장/렌더링(AGENTS.md 코딩 컨벤션과 정합). 리포지토리 경계 밖으로 `Json` 원시 타입을 노출하지 않는다.
