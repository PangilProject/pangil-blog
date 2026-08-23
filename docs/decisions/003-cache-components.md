# ADR-003. 캐시 무효화: Cache Components + `updateTag` 채택

- 상태: **채택** (2026-08-23)
- 관련 문서: `docs/02-information-architecture.md` §3.2, `docs/04-frontend-architecture.md` §1.2, `docs/07-roadmap.md` M3
- 검증 수단: M3 슬라이스 1 빌드 통과 + 발행 직후 공개 상세에서 방금 쓴 내용 확인

## 맥락

02 §3.2가 **"발행 직후 해당 글의 공개 페이지로 이동"** 을 확정했다. 근거는 "방금 쓴 글 확인이
자연스럽고 UI 애착에 기여". 그러면 도착한 페이지는 방금 쓴 내용을 보여줘야 한다
(read-your-own-writes).

Next 16은 무효화를 두 갈래로 나눴다.

| API | 동작 | 전제 |
|-----|------|------|
| `revalidateTag(tag, profile)` | stale-while-revalidate — 낡은 내용을 먼저 보여주고 뒤에서 갱신 | 없음 |
| `updateTag(tag)` | 즉시 만료. Server Action 전용 | **Cache Components** |

M2에서는 공개 지면이 없어 `revalidateTag(tag, "max")`로 자리만 잡아두고 결정을 M3로 넘겼다
(`lib/actions/posts.ts` 주석).

## 결정

**`cacheComponents: true`를 켜고, 발행·수정·삭제 경로는 `updateTag`를 쓴다.**

- 캐시할 것은 `use cache`로 감싸 명시한다. 공개 지면은 캐시가 기본이다
- 요청마다 달라지는 것(인증·쿠키)은 동적으로 남긴다. 관리 영역은 레이아웃에서
  `connection()` + `instant = false`로 **프리렌더하지 않음**을 한 곳에 명시한다
- 태그 체계(`post:{id}` / `list:{site}` / `list:{site}:{facet}` / `tag:{site}:{name}` /
  `feed:{site}`)는 04 §1.2 그대로 유지한다. 바뀌는 것은 무효화 API뿐이다

## 근거

1. **발행 직후 낡은 내용을 보여주는 것은 이 프로젝트에서 기능 결함이 아니라 신뢰 결함이다.**
   저장 인디케이터에 "신뢰의 시각화"(02 §3.4)라는 이름을 붙인 제품이, 발행하고 도착한 페이지에서
   방금 쓴 문장을 못 보여주면 그 축이 무너진다
2. **전환 비용이 가장 싼 시점이다.** 공개 지면이 0개인 지금 켜면 관리 화면 3곳만 손대면 된다.
   목록·상세·피드·OG를 다 만든 뒤 켜면 전부 다시 검토해야 한다
3. `updateTag`는 Server Action 전용이고, 우리의 발행 경로는 이미 전부 Server Action이다
   (`withAdmin` 래퍼, 05 §3.2) — 규칙과 코드가 이미 맞물려 있다

## 대가 (수용)

- **캐시 경계를 명시해야 한다.** 데이터 접근이 캐시 밖에 있으면 빌드가 거부한다. 이건 비용이지만
  동시에 이득이다 — "이 화면이 캐시되는가"가 코드에 적힌다
- **프리렌더는 재현 가능한 출력만 허용한다.** 렌더 중 난수·시각을 쓰면 빌드가 거부한다. 실제로
  찬양 폼의 첫 섹션 id가 `nanoid()`라 걸렸고, 자리 번호로 바꿨다(브라우저에서 섹션을 더할 때만
  난수를 쓴다). Tiptap도 렌더 중 난수를 쓰기 때문에 에디터 페이지는 프리렌더 대상이 아니다
- Cache Components는 비교적 새 기능이다. 공개 지면을 만들며 문제가 드러나면 이 ADR을 갱신한다

## 기각한 대안

- **`revalidateTag(tag, "max")` 유지 + 발행 직후만 우회**: 도착 페이지 요청만 동적으로 만드는
  장치가 필요하고, 그 장치가 캐시 규칙을 두 벌로 만든다. 복잡도가 오히려 크다
- **시간 기반 ISR**: 04 결정 로그 #1에서 이미 기각(1인 블로그의 변경은 100% 작성자 행동에서 온다)
- **캐시 없이 전부 동적**: 검색 유입 기술 글이 SEO 주력(02 §2.2)인데 매 요청 DB를 훑는다.
  무료 티어에서 특히 아깝다

## 영향

- `docs/04-frontend-architecture.md` §1.2의 `revalidateTag` 일괄 호출을 `updateTag`로 갱신할 것
  (M3 슬라이스 4에서 실제 적용과 함께)
- `app/admin/layout.tsx`: `connection()` + `instant = false`
- `next.config.ts`: `cacheComponents: true`
