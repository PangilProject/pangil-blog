/**
 * `/project` 목록과 상세의 **문구 정본**. ADR-005.
 *
 * 이 파일이 작업물 지면의 전부다. 화면은 여기 적힌 것만 그리고, **빈 값이면 그 블록을
 * 그리지 않는다.** 스크린샷이 없어도, 링크가 없어도, 기능 목록이 비어도 지면은 깨지지 않는다.
 *
 * ## 허브와의 분담 (ADR-005 대가 #3)
 *
 * 허브 `장 넷 · 만든 것`(`hubContent.ts`의 `hubWorks`)은 **무엇을 버렸는가**를 적고,
 * 이 파일은 **이 서비스가 무엇이고 어떤 기능이 있는가**를 적는다. 같은 문장을 두 군데 두지
 * 않는다 — 낡는 것은 중복된 사실이다.
 *
 * `hubWorks`의 `project`가 여기 있는 `slug`를 가리키면 허브에 `자세히 ↗`가 붙는다.
 * 없는 slug를 가리키면 `projectContent.test.ts`가 실패한다.
 *
 * ## 스크린샷
 *
 * `public/projects/{slug}/`에 둔다. Supabase Storage를 쓰지 않는다 — 올리는 화면이 없으므로
 * 저장소를 쓸 이유가 없고, git에 두면 문구와 그림이 한 커밋으로 움직인다.
 *
 * 굽는 것은 `npm run shots -- <slug> <원본...>`이 한다 — 긴 변을 보고 줄이고, 상한을 넘으면
 * 품질을 내려 다시 굽고, **붙여 넣을 `shots` 배열을 치수까지 찍어 준다.** 치수를 손으로
 * 옮기면 틀리고, 틀리면 그림이 도착할 때 지면이 튄다.
 *
 * **상한(ADR-005): webp · 긴 변 1400px · 건당 10장 이하 · 장당 200KB 이하.**
 * 지금 `images.unoptimized: true`라(2026-09 Storage 초과 회차) **올린 바이트가 그대로
 * 내려간다.** 최적화기가 뒤에서 구해 주지 않는다. `projectContent.test.ts`가 이 상한을 잠근다.
 *
 * **목록의 썸네일은 `shots[0]`이다.** 따로 고르게 하지 않는다 — 고르는 자리를 만들면
 * 그 값이 본문과 어긋나기 시작하고, 첫 장이 대표가 아니면 상세에서도 첫 장이 아니어야 한다.
 *
 * **재검토: 2027-03-20** — 그때까지 항목이 하나도 안 늘었으면 이 지면을 걷는다(ADR-005).
 */

/** 목록에서 묶는 축. 서비스·팀·실험 셋 말고 늘리지 않는다 */
export type ProjectKind = "서비스" | "팀" | "실험";

export type ProjectLink = { label: string; href: string };

/** 기능 하나. `name`은 짧게, `body`는 한두 문장 */
export type ProjectFeature = { name: string; body: string };

/** 스택은 묶어서 적는다 — 나열만 하면 무엇을 왜 골랐는지가 안 읽힌다 */
export type ProjectStackGroup = { group: string; items: string[] };

/**
 * `src`는 `public/` 기준 절대 경로. `alt`는 비우지 않는다.
 *
 * **`width`·`height`는 실제 픽셀이어야 한다.** `next/image`가 그 값으로 자리를 먼저 잡는다 —
 * 틀리면 그림이 도착할 때 지면이 튄다. 파일을 넣고 `sips -g pixelWidth -g pixelHeight`로 읽어 적는다.
 */
export type ProjectShot = {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
};

export type Project = {
  /** `/project/{slug}`. 한 번 정하면 바꾸지 않는다 — 주소는 불변이다(05 §6.4) */
  slug: string;
  kind: ProjectKind;
  title: string;
  /** 한 줄. 목록에서 제목 아래 선다 */
  tagline: string;
  period: string;
  /** 운영 중 · 운영 종료 · 완료 */
  status: string;
  /** 1인인지 팀인지 */
  team: string;
  role: string;
  /** 어떤 서비스인가. 문단 배열 — 두세 문단을 넘기지 않는다 */
  summary: string[];
  features: ProjectFeature[];
  stack: ProjectStackGroup[];
  /** 만들면서 부딪힌 것. 없으면 그 블록을 안 그린다 */
  notes?: string[];
  shots: ProjectShot[];
  links: ProjectLink[];
};

/**
 * **표시 순서는 이 배열 그대로다** — 최근 손댄 것이 위다. 정렬 코드를 두지 않는다.
 * 순서를 바꾸고 싶으면 이 배열을 옮긴다.
 */
export const projects: Project[] = [
  {
    slug: "checky",
    kind: "서비스",
    title: "checky",
    tagline: "일회성 할 일과 반복 루틴을 나눠 기록하는 습관 관리 서비스",
    period: "2026.01 —",
    status: "운영 중",
    team: "1인",
    role: "기획 · 정보 구조 · 프론트엔드 · 배포",
    summary: [
      "할 일 앱은 대개 단기 할 일과 반복 습관을 한 목록에 섞어 둡니다. 그러면 오늘 반드시 해야 하는 일과 꾸준히 유지해야 하는 행동이 같은 무게로 보이고, 목록이 길어질수록 둘 다 흐려집니다.",
      "checky는 그 둘을 저장 단계에서 갈라 둡니다. 날짜가 고정된 일회성 할 일은 Task, 요일·기간 규칙을 가진 습관은 Routine입니다. 화면은 이 구분을 그대로 따라가서, 하루 단위 실행과 월 단위 추이를 동시에 볼 수 있습니다.",
    ],
    features: [
      {
        name: "Task와 Routine 분리",
        body: "날짜 고정 할 일과 반복 규칙을 다른 것으로 저장합니다. 홈에서는 오늘 몫만 합쳐 보여 줍니다.",
      },
      {
        name: "카테고리 관리",
        body: "분류를 만들고 활성·종료 상태와 순서를 바꿉니다. 끝난 분류를 지우지 않고 내려 두면 과거 기록이 살아 있습니다.",
      },
      {
        name: "월간 리포트",
        body: "한 달치 수행 패턴을 모아 봅니다. 하루만 보면 안 보이는 것이 여기서 보입니다.",
      },
      { name: "드래그 정렬", body: "루틴과 카테고리 순서를 끌어서 바꿉니다." },
      { name: "관리자 대시보드", body: "사용 현황을 한 화면에서 봅니다." },
    ],
    stack: [
      { group: "화면", items: ["React", "TypeScript", "Vite", "Tailwind CSS"] },
      { group: "상태·데이터", items: ["TanStack Query", "Zustand", "Firebase"] },
      { group: "그 외", items: ["dnd-kit", "Recharts", "Vitest"] },
    ],
    notes: [
      "초기 JS 번들을 약 90% 줄였습니다. 먼저 정한 것은 무엇을 줄일지가 아니라 **초기 렌더에 정말 필요한 코드가 무엇인가**였고, 답이 나온 뒤에야 vendor chunk 분리와 코드 스플리팅이 의미를 가졌습니다.",
      "화면을 옮길 때마다 같은 요청이 반복되고 있었습니다. 캐시 기준을 데이터 성격별로 나눠 세우고 나서 사라졌습니다.",
    ],
    shots: [
      { src: "/projects/checky/01.webp", alt: "주별 달성 현황", width: 1400, height: 768 },
      { src: "/projects/checky/02.webp", alt: "월별 달성 현황", width: 1400, height: 765 },
      { src: "/projects/checky/03.webp", alt: "캘린더와 루틴", width: 1400, height: 766 },
      { src: "/projects/checky/04.webp", alt: "할 일 목록", width: 1400, height: 766 },
      { src: "/projects/checky/05.webp", alt: "카테고리 관리", width: 1400, height: 763 },
      { src: "/projects/checky/06.webp", alt: "루틴 등록", width: 1400, height: 769 },
      { src: "/projects/checky/07.webp", alt: "마이 정보", width: 1400, height: 765 },
      { src: "/projects/checky/08.webp", alt: "공지", width: 1400, height: 768 },
    ],
    links: [
      { label: "바로가기", href: "https://checky.today" },
      { label: "코드 보기", href: "https://github.com/PangilProject/checky" },
    ],
  },
  {
    slug: "jogak",
    kind: "서비스",
    title: "조각",
    tagline: "그룹 미션을 인증하고 조각 판을 채워가는 조직용 미션 인증 서비스",
    period: "2026.07 —",
    status: "운영 중",
    team: "1인",
    role: "기획 · 설계 · 프론트엔드 · 백엔드 · 배포",
    summary: [
      "조직을 그룹으로 나누고, 그룹별로 미션을 수행·인증하게 해서 목표 활동을 게임처럼 관리하는 서비스입니다. 관리자는 미션과 일정을 설계하고, 구성원은 사진이나 글로 인증하고, 관리자가 승인하거나 거절합니다.",
      "그룹이 미션을 완료할수록 조각 판이 한 칸씩 채워집니다. 진행 상황을 숫자로 적는 대신 판으로 보여 주면, 남은 칸이 곧 다음에 할 일이 됩니다.",
    ],
    features: [
      {
        name: "조직 → 그룹 → 미션",
        body: "세 층으로 나눠 관리합니다. 미션은 그룹 단위로 배정됩니다.",
      },
      {
        name: "사진·글 인증",
        body: "미션마다 인증 요건을 정하고, 자동 승인 여부도 미션별로 설정합니다.",
      },
      {
        name: "검토 흐름",
        body: "관리자가 승인하거나 거절합니다. 미처리 건수는 사이드바에 배지로 남습니다.",
      },
      { name: "조각 판", body: "그룹별 완료율과 진행 순위를 판 위에서 봅니다." },
      { name: "앱처럼 설치", body: "PWA라서 홈 화면에 올리면 주소창 없이 실행됩니다." },
    ],
    stack: [
      { group: "화면", items: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Radix UI"] },
      { group: "데이터", items: ["Supabase", "Postgres", "Prisma", "Zod"] },
      { group: "배포", items: ["Vercel"] },
    ],
    shots: [],
    links: [{ label: "바로가기", href: "https://jogaks.vercel.app" }],
  },
  {
    slug: "repeak",
    kind: "실험",
    title: "RePeak",
    tagline: "운동을 기록하면 코인을 얻고, 코인으로 캐릭터의 방을 꾸미는 게이미피케이션 서비스",
    period: "2026.06",
    status: "완료",
    team: "1인",
    role: "기획 · 설계 · 구현",
    summary: [
      "운동이 안 이어지는 이유는 대개 의지가 아니라 되돌아오는 것이 없어서입니다. RePeak은 운동 기록을 코인으로 바꾸고, 그 코인으로 캐릭터의 방을 꾸미게 합니다. 누적할수록 캐릭터가 다섯 단계로 자랍니다.",
      "핵심 루프는 하나입니다. 운동하고 · 코인을 받고 · 꾸미고 · 또 하고 싶어집니다.",
    ],
    features: [
      {
        name: "운동 기록",
        body: "종목과 양을 적으면 코인으로 환산됩니다. 그날 첫 운동에는 보너스가 붙습니다.",
      },
      { name: "캐릭터 성장", body: "누적 운동 점수로 다섯 단계 진화합니다." },
      { name: "방 꾸미기", body: "상점에서 아이템을 사서 방에 배치합니다." },
      { name: "관리자 도구", body: "종목 관리, 사용자 초기화, 집계 대시보드." },
    ],
    stack: [
      { group: "화면", items: ["React", "TypeScript", "Vite", "React Router"] },
      { group: "데이터", items: ["Supabase", "Postgres", "Supabase Auth"] },
      { group: "구조", items: ["pnpm workspaces", "Zustand"] },
    ],
    notes: [
      "코인·인벤토리·배치 변경은 전부 서버 쪽 RPC에서만 일어납니다. 클라이언트는 게임 상태를 읽기만 할 수 있습니다 — 값을 화면에서 계산하면 화면을 고친 사람이 곧 잔고를 고칩니다.",
      "게임 로직은 UI에 의존하지 않는 순수 TypeScript 패키지로 뺐습니다. 코인 환산 규칙이 클라이언트와 서버 두 곳에 있어야 했고, 두 벌이면 반드시 한쪽이 낡기 때문입니다.",
      "폰트는 npm으로 받아 직접 호스팅합니다. 브라우저마다 다른 기본 글꼴로 숫자 폭이 흔들리면 게임 화면이 어긋납니다.",
    ],
    shots: [],
    links: [],
  },
  {
    slug: "if-kbo",
    kind: "서비스",
    title: "만약에KBO",
    tagline: "남은 경기를 가정해 순위 변화를 보는 KBO 순위·일정 서비스",
    period: "2026.04 —",
    status: "운영 중",
    team: "1인",
    role: "기획 · 설계 · 구현 · 자동화 · 운영",
    summary: [
      "시즌 후반이 되면 순위표만으로는 궁금한 것이 안 풀립니다. 알고 싶은 것은 지금 몇 위인지가 아니라 “우리 5위 가나”이기 때문입니다.",
      "만약에KBO는 남은 경기를 직접 골라 보게 하고, 동시에 만 번 시뮬레이션해서 팀별 포스트시즌 확률과 최종 순위 분포를 보여 줍니다. 로그인 없이 씁니다.",
    ],
    features: [
      {
        name: "순위표",
        body: "승률·게임차·연속·다음 상대. 팀을 하나 고르면 요약 카드가 맨 위에 붙습니다. 고른 팀은 그 기기에만 저장됩니다.",
      },
      {
        name: "가을야구 확률",
        body: "남은 경기를 10,000번 시뮬레이션해 팀별 확률과 순위 분포를 냅니다.",
      },
      {
        name: "남은 경기 고르기",
        body: "날짜를 넘겨 가며 이길 팀을 고르면 순위가 그 자리에서 바뀝니다.",
      },
      {
        name: "결과 공유",
        body: "골라 본 결과가 링크에 담깁니다. 받은 사람은 같은 화면에서 바로 반박할 수 있습니다.",
      },
      {
        name: "자동 수집",
        body: "경기 결과가 KBO 게임센터에서 자동으로 들어옵니다. 평소에는 손댈 일이 없습니다.",
      },
      {
        name: "운영자 화면",
        body: "일정 생성, 대진 편집, 결과 입력, 일자 단위 삭제와 되살리기, 백업 내보내기.",
      },
    ],
    stack: [
      { group: "화면", items: ["React 19", "TypeScript", "Vite", "Tailwind CSS v4"] },
      { group: "상태·데이터", items: ["TanStack Query", "Zustand", "Supabase"] },
      { group: "검증", items: ["Vitest", "Testing Library", "PGlite"] },
    ],
    shots: [],
    links: [{ label: "바로가기", href: "https://if-kbo.vercel.app" }],
  },
  {
    slug: "digital-yutnori-board",
    kind: "실험",
    title: "윷놀이 디지털 말판",
    tagline: "윷은 손으로 던지고, 말은 화면에서 옮기는 디지털 말판",
    period: "2026.02",
    status: "운영 중",
    team: "1인",
    role: "기획 · 구현 · 배포",
    summary: [
      "윷놀이에서 다툼이 나는 자리는 던지는 쪽이 아니라 말을 옮기는 쪽입니다. 지름길을 탔는지, 잡았는지 업었는지, 몇 칸 남았는지를 사람이 세다 보면 판마다 셈이 달라집니다.",
      "그래서 던지는 것은 오프라인에 두고, 판만 화면으로 옮겼습니다. 경로 계산과 잡기·업기 판정은 화면이 합니다.",
    ],
    features: [
      {
        name: "자동 길 찾기",
        body: "지름길과 정규 경로를 알고리즘이 계산해 갈 수 있는 자리를 보여 줍니다.",
      },
      {
        name: "잡기와 업기",
        body: "상대 말을 잡거나 같은 팀 말을 업는 규칙이 자동으로 적용됩니다.",
      },
      { name: "팀 대시보드", body: "점수·남은 말·진행 상황을 한눈에 봅니다." },
      {
        name: "진행 상황 보존",
        body: "브라우저를 닫아도 판이 남습니다. 초기화에는 확인을 둡니다.",
      },
    ],
    stack: [
      { group: "화면", items: ["React", "TypeScript", "Vite", "Tailwind CSS", "shadcn/ui"] },
      { group: "배포", items: ["Vercel"] },
    ],
    shots: [],
    links: [
      { label: "바로가기", href: "https://digital-yutnori-board.vercel.app" },
      { label: "코드 보기", href: "https://github.com/PangilProject/digital-yutnori-board" },
    ],
  },
  {
    slug: "sdrum-guitar",
    kind: "팀",
    title: "에스드럼기타 학원 관리 시스템",
    tagline: "학생·수강·스케줄·청구를 한곳에서 관리하는 교습소 운영 도구",
    period: "2026.01 — 2026.03",
    status: "완료",
    team: "팀",
    role: "프론트엔드",
    summary: [
      "실제로 운영 중인 음악 교습소의 업무를 디지털로 옮긴 관리 도구입니다. 학생 등록에서 수강, 스케줄, 출결, 청구, 문자 발송까지 한 흐름으로 묶었습니다.",
      "학원 업무는 화면이 아니라 흐름으로 이어집니다. 학생을 등록하면 수강이 생기고, 수강이 스케줄과 출결을 만들고, 수강을 기준으로 청구서가 나옵니다. 그 순서대로 화면을 놓았습니다.",
    ],
    features: [
      { name: "학생 관리", body: "등록·수정·조회와 수강생 상태 관리." },
      { name: "수강 관리", body: "과목 개설, 수강 등록과 취소, 이력 추적." },
      { name: "회차·스케줄", body: "수업 스케줄 생성과 변경, 출결·보강·이월 처리." },
      { name: "청구·결제", body: "학생별 청구서 조회와 납부 상태 변경." },
      { name: "문자 관리", body: "템플릿 기반 발송과 발송 이력. 템플릿과 이력을 갈라 둡니다." },
    ],
    stack: [
      { group: "화면", items: ["React 19", "TypeScript", "Vite", "Tailwind CSS"] },
      { group: "상태·데이터", items: ["TanStack Query", "Zustand", "Firebase"] },
      { group: "배포", items: ["GitHub Actions", "Firebase Hosting"] },
    ],
    shots: [],
    links: [{ label: "코드 보기", href: "https://github.com/sDrumGuitar/sDrumGuitar-FE" }],
  },
  {
    slug: "hgu-student-union",
    kind: "팀",
    title: "한동대학교 총학생회 웹사이트",
    tagline: "학교 구성원이 보는 공개 지면과 운영진이 쓰는 관리자 콘솔",
    period: "2023.05 —",
    status: "운영 중",
    team: "팀 · 다년간 인수인계",
    role: "웹 프론트엔드 · 현대화 작업",
    summary: [
      "학교 구성원이 공지·자료실·일정을 보는 공개 지면과, 운영진이 그 내용을 채우는 관리자 콘솔 두 벌로 이뤄져 있습니다. 실제로 매 학기 학교 전체가 쓰는 서비스입니다.",
      "여러 해에 걸쳐 개발자가 바뀌며 이어져 온 저장소라, 새 기능을 더하는 일만큼 이미 있는 것을 읽히게 만드는 일이 중요했습니다. 공개 지면은 구 CRA와 styled-components를 걷어내고 Vite · TypeScript · Tailwind 기반으로 옮기면서, 따로 있던 PC용·모바일용 화면을 반응형 한 벌로 합쳤습니다.",
    ],
    features: [
      { name: "공지·자료실", body: "글과 첨부를 올리고 분류합니다. 본문은 에디터로 작성합니다." },
      { name: "팝업·배너 관리", body: "공개 지면 상단과 첫 화면에 나갈 것을 관리자가 정합니다." },
      { name: "회원 관리", body: "권한과 접근을 나눕니다. 관리자 콘솔은 외부 접근을 막습니다." },
      { name: "반응형 단일화", body: "PC용과 모바일용으로 갈려 있던 화면을 한 벌로 합쳤습니다." },
    ],
    stack: [
      { group: "공개 지면", items: ["React", "TypeScript", "Vite", "Tailwind CSS v4", "Recoil"] },
      {
        group: "관리자",
        items: ["React", "TanStack Query", "styled-components", "MUI", "CKEditor"],
      },
      { group: "서버·배포", items: ["Spring Boot", "JPA", "QueryDSL", "AWS"] },
    ],
    notes: [
      "화면이 PC용과 모바일용으로 갈려 있으면 기능 하나를 더할 때마다 두 번 고쳐야 하고, 반드시 한쪽이 빠집니다. 합치는 쪽이 당장은 크지만 그 뒤로는 계속 쌉니다.",
    ],
    shots: [],
    links: [{ label: "바로가기", href: "https://stu.handong.edu" }],
  },
  {
    slug: "pangil-blog",
    kind: "서비스",
    title: "지금 보고 있는 이 지면",
    tagline: "하나의 앱이 호스트에 따라 소개·기술 블로그·묵상 블로그 세 지면으로 갈립니다",
    period: "2026.08 —",
    status: "운영 중",
    team: "1인",
    role: "기획 · 설계 · 구현 · 운영",
    summary: [
      "다른 플랫폼에서 2년 넘게 쓰던 글을 옮겨 오면서, 매일 같은 형식을 손으로 입력하던 일을 없애려고 만들었습니다. 소개 지면과 기술 블로그, 묵상 블로그가 같은 코드와 같은 디자인 토큰을 쓰고, 갈리는 축은 액센트 색 하나뿐입니다.",
      "글의 종류마다 저장 형식과 에디터가 다릅니다. 큐티·설교·찬양·기술 넷이 각자의 구조를 갖고, 발행할 때 청구기호가 붙습니다. 매일 새벽 크롤러가 그날 몫의 초안을 만들어 둡니다.",
    ],
    features: [
      {
        name: "세 지면 한 앱",
        body: "호스트로 갈립니다. 디자인 토큰은 한 벌이고 액센트 색만 다릅니다.",
      },
      {
        name: "타입별 에디터",
        body: "글 종류마다 저장 구조와 작성 화면이 다릅니다. 설교 에디터는 네트워크가 끊겨도 기록이 남습니다.",
      },
      {
        name: "자동 초안",
        body: "매일 새벽 크롤러가 그날의 본문과 질문을 가져와 초안을 만듭니다. 실패하면 조용히 넘어가지 않고 알림이 옵니다.",
      },
      {
        name: "직접 만든 통계",
        body: "조회·유입·기기·체류 시간을 직접 모아 봅니다. 차트 라이브러리를 넣지 않았습니다.",
      },
      { name: "옛 글 이전", body: "749편을 표 298개까지 살려 옮겼습니다." },
    ],
    stack: [
      { group: "화면", items: ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS v4"] },
      { group: "데이터", items: ["Prisma", "Postgres", "Supabase", "Zod"] },
      { group: "자동화", items: ["GitHub Actions", "Vercel"] },
    ],
    notes: [
      "세 지면에 각자 변수를 주자는 안을 버렸습니다. 어긋나기 시작하면 하나를 고치려고 셋을 고치게 됩니다.",
      "공개 지면에 내려보내는 클라이언트 코드에 상한을 두고, 테스트가 그 숫자를 잠급니다. 늘리려면 먼저 문서에 한 번 물어야 합니다.",
    ],
    shots: [],
    links: [
      { label: "바로가기", href: "https://kwangilkim.com" },
      { label: "코드 보기", href: "https://github.com/PangilProject/pangil-blog" },
    ],
  },
  {
    slug: "public-of-essence",
    kind: "팀",
    title: "ESSENCE 공식 홈페이지",
    tagline: "집회 일정과 지난 예배 아카이브를 담은 선교단체 공식 지면",
    period: "2024.05 —",
    status: "운영 중",
    team: "1인",
    role: "기획 · 프론트엔드 · 배포 · 운영",
    summary: [
      "경기도 시흥시 기반 청년·청소년 선교단체의 공식 홈페이지입니다. 집회와 수련회 일정, 지난 예배 아카이브, 단체 소개를 담았습니다.",
      "글을 자주 쓰는 지면이 아니라 일정이 바뀌는 지면이라, 관리 화면을 만들지 않고 정적 사이트로 내보냅니다. 고칠 것이 생기면 파일을 고치고 다시 배포합니다.",
    ],
    features: [
      { name: "단체 소개", body: "무엇을 하는 곳인지 먼저 읽히게 놓았습니다." },
      { name: "일정", body: "다가오는 집회와 수련회를 봅니다." },
      {
        name: "지난 집회 아카이브",
        body: "예배 영상과 자료를 모아 두고, 집회별 상세로 들어갑니다.",
      },
      { name: "문의·후원", body: "연락과 후원 안내를 한 화면에 둡니다." },
    ],
    stack: [
      { group: "화면", items: ["Next.js 16", "React 19", "TypeScript", "styled-components"] },
      { group: "미디어", items: ["embla-carousel", "react-youtube", "Cloudinary"] },
      { group: "배포", items: ["정적 export", "Netlify"] },
    ],
    shots: [],
    links: [
      { label: "바로가기", href: "https://essence2016.netlify.app" },
      { label: "코드 보기", href: "https://github.com/PangilProject/PublicOfEssence" },
    ],
  },
  {
    slug: "my-christmas-card",
    kind: "실험",
    title: "나의 크리스마스 카드",
    tagline: "열두 문항으로 크리스마스 유형을 찾고 결과 카드를 저장하는 테스트",
    period: "2025.12",
    status: "완료",
    team: "1인",
    role: "기획 · 구현 · 배포",
    summary: [
      "2025년 크리스마스에 맞춰 짧게 만든 테스트입니다. 열두 문항에 답하면 여덟 가지 유형 중 하나가 나오고, 어울리는 활동과 캐롤을 추천합니다.",
      "테스트 자체보다 결과를 남기고 넘기는 쪽에 무게를 뒀습니다. 결과 카드를 이미지나 움직이는 GIF로 저장할 수 있고, 링크로도 넘깁니다.",
    ],
    features: [
      { name: "열두 문항 테스트", body: "질문이 넘어갈 때 애니메이션이 붙습니다." },
      { name: "여덟 유형", body: "유형마다 어울리는 활동과 캐롤을 추천합니다." },
      { name: "결과 카드 저장", body: "이미지와 GIF 두 가지로 내려받습니다." },
      { name: "링크 공유", body: "결과를 링크로 넘깁니다. 참여자 수를 함께 셉니다." },
    ],
    stack: [
      { group: "화면", items: ["React", "TypeScript", "Vite", "styled-components"] },
      { group: "데이터", items: ["Firebase Realtime Database"] },
      { group: "그 외", items: ["html2canvas", "react-youtube", "Netlify"] },
    ],
    shots: [],
    links: [{ label: "코드 보기", href: "https://github.com/PangilProject/my-christmas-card" }],
  },
  {
    slug: "re-log",
    kind: "서비스",
    title: "re-log",
    tagline: "회고를 어떻게 써야 할지 막막한 사람을 위한 회고 기록 서비스",
    period: "2025.11 —",
    status: "운영 중",
    team: "1인",
    role: "기획 · 프론트엔드 · QA · 배포",
    summary: [
      "회고를 쓰려다 빈 화면 앞에서 멈추는 사람을 위해 만들었습니다. KPT처럼 구조가 잡힌 회고 폼을 먼저 고르게 하고, 섹션마다 무엇을 적는 자리인지 안내를 붙였습니다.",
      "마크다운 에디터는 직접 만들었습니다. 실시간 미리보기와 코드 하이라이팅을 붙이고, 렌더링 직전에 정화 단계를 한 번 거칩니다.",
    ],
    features: [
      {
        name: "마크다운 에디터",
        body: "실시간 미리보기와 코드 하이라이팅. 작성 중 화면이 갈리지 않습니다.",
      },
      { name: "구조화된 회고 폼", body: "KPT 같은 형식을 고르면 섹션과 안내가 함께 놓입니다." },
      { name: "감정 기록", body: "쓸 때의 감정을 함께 남기고, 목록에서 한눈에 봅니다." },
      { name: "목록 관리", body: "분류 필터, 제목·내용 검색, 정렬, 더 불러오기." },
      { name: "회고 공유", body: "고유 링크를 만들어 밖으로 넘깁니다." },
      { name: "관리자 대시보드", body: "사용자·게시물·피드백 현황을 차트로 봅니다." },
    ],
    stack: [
      { group: "화면", items: ["SvelteKit", "Svelte 5", "TypeScript", "Tailwind CSS"] },
      { group: "에디터", items: ["markdown-it", "prism.js", "DOMPurify"] },
      { group: "데이터·검증", items: ["Firebase", "Vitest", "Playwright"] },
    ],
    notes: [
      "렌더링 직전에 DOMPurify를 태워 XSS 통로를 막았습니다. 사용자가 쓴 마크다운을 그대로 그리는 화면에서는 이 한 줄이 없으면 본문이 곧 실행 경로가 됩니다.",
      "MVP 이후 15명을 모아 QA를 돌렸습니다. 고친 것의 대부분은 기능이 아니라 “여기서 뭘 해야 하는지 모르겠다”였습니다.",
    ],
    shots: [],
    links: [
      { label: "바로가기", href: "https://relog.shop" },
      { label: "코드 보기", href: "https://github.com/PangilProject/re-log" },
    ],
  },
  {
    slug: "blridge",
    kind: "팀",
    title: "BL-ridge",
    tagline: "헌혈 가능 여부를 스스로 진단하고 챌린지로 이어 가는 앱",
    period: "2025.09 — 2025.12",
    status: "완료",
    team: "팀",
    role: "모바일 프론트엔드",
    summary: [
      "헌혈을 하려다 막히는 자리는 헌혈 장소가 아니라 그 전입니다. 내가 지금 할 수 있는 상태인지 스스로 알기 어렵기 때문입니다.",
      "BL-ridge는 질병 이력·해외 방문·약물 복용 같은 항목을 물어 그 자리에서 적격 여부를 알려 주고, 안 되면 언제부터 가능한지까지 말해 줍니다. 그 뒤를 챌린지와 커뮤니티로 이어 붙였습니다.",
    ],
    features: [
      {
        name: "자가 진단",
        body: "가이드라인에 따라 문항에 답하면 그 자리에서 적격 여부가 나옵니다.",
      },
      { name: "부적격 사유 안내", body: "안 되는 이유와 다음 가능 시점을 함께 알려 줍니다." },
      {
        name: "헌혈 챌린지",
        body: "개인·그룹 목표를 세우고 진행 상황을 봅니다. 달성하면 배지가 붙습니다.",
      },
      { name: "기록 관리", body: "헌혈 기록을 인증해 남기고, 횟수·종류·날짜를 시각화합니다." },
      { name: "커뮤니티", body: "경험담과 달성 소식을 나누고 댓글을 답니다." },
    ],
    stack: [{ group: "앱", items: ["Flutter", "Dart"] }],
    shots: [],
    links: [],
  },
  {
    slug: "qrapo",
    kind: "팀",
    title: "QRapo",
    tagline: "처음 만난 사람들이 단계별 콘텐츠로 관계를 쌓게 돕는 서비스",
    period: "2025.01 — 2025.05",
    status: "완료",
    team: "팀 · 캡스톤 디자인",
    role: "PM · 디자인 · 프론트엔드 리드",
    summary: [
      "어색한 첫 만남에서 대화가 안 풀리는 이유는 말할 거리가 없어서가 아니라 무엇부터 꺼내야 할지 모르기 때문입니다. QRapo는 그 순서를 대신 정해 줍니다.",
      "프로필 설정에서 시작해 경험 공유, 취향 탐색, 약속 생성, 회고까지 다섯 단계로 이어집니다. 기업 연계 캡스톤 과제로 진행했습니다.",
    ],
    features: [
      {
        name: "단계별 콘텐츠",
        body: "프로필 · 경험 공유 · 취향 탐색 · 약속 생성 · 회고 다섯 단계.",
      },
      { name: "그룹과 매칭", body: "그룹을 만들거나 참여해서 함께 진행합니다." },
      { name: "약속 생성", body: "날짜와 장소를 정합니다. 장소는 지도에서 검색해 고릅니다." },
      { name: "회고", body: "만남이 끝나면 남길 것을 적습니다." },
    ],
    stack: [
      { group: "화면", items: ["Next.js", "TypeScript", "Tailwind CSS", "Zustand"] },
      { group: "연동", items: ["Kakao Map SDK", "Google OAuth", "Axios"] },
      { group: "서버·배포", items: ["Spring Boot", "JPA", "MySQL", "AWS EC2", "Vercel"] },
    ],
    notes: [
      "프론트엔드 구조를 세우기 전에 15개 테이블 ERD와 API 명세를 문서로 먼저 확정했습니다. 두 사람이 나눠 만드는 일에서 합의가 코드보다 늦으면 합치는 자리에서 전부 다시 하게 됩니다.",
      "장소를 자유 입력으로 받던 것을 검색·선택으로 바꿨습니다. 같은 장소가 매번 다른 값으로 저장되고 있었고, 고치는 것보다 못 틀리게 하는 쪽이 쌉니다.",
    ],
    shots: [],
    links: [{ label: "코드 보기", href: "https://github.com/Official-QRapo/QRapo_FE" }],
  },
  {
    slug: "team-cc",
    kind: "팀",
    title: "팀CC",
    tagline: "학교의 팀 교류 프로그램을 온라인에서 운영하는 서비스",
    period: "2025.04 — 2025.06",
    status: "완료",
    team: "팀",
    role: "프론트엔드",
    summary: [
      "한동대학교에서 오래 이어져 온 팀 교류 프로그램을 온라인으로 옮긴 서비스입니다. 참여자는 로그인해서 이벤트에 들어가고, 짝을 만나 미션을 수행하고, 인증으로 점수를 쌓습니다.",
      "오프라인에서 종이와 말로 굴러가던 것을 그대로 옮기지 않고, 운영자가 손으로 세던 점수와 순위를 화면이 세도록 했습니다.",
    ],
    features: [
      { name: "초대코드 참여", body: "구글 계정으로 로그인하고 초대코드로 이벤트에 들어갑니다." },
      { name: "짝 매칭", body: "참여자끼리 짝을 맺습니다." },
      { name: "미션 인증", body: "미션을 수행하고 인증을 올립니다." },
      { name: "점수와 순위표", body: "쌓인 점수를 확인하고 순위를 봅니다." },
    ],
    stack: [
      { group: "화면", items: ["React 19", "React Router", "styled-components"] },
      { group: "인증·통신", items: ["Google OAuth2", "JWT", "Axios"] },
    ],
    shots: [],
    links: [{ label: "코드 보기", href: "https://github.com/2025-TeamCC/Team_CC_FE" }],
  },
  {
    slug: "pard-app-admin",
    kind: "팀",
    title: "PARD 관리자 페이지",
    tagline: "동아리 운영진이 구성원·일정·출결·점수를 한곳에서 관리하는 내부 도구",
    period: "2024.01 — 2025.04",
    status: "운영 종료",
    team: "팀 · 15개월",
    role: "웹 프론트엔드 · 서버 전환 대응",
    summary: [
      "IT 동아리 운영진이 쓰는 내부 관리 도구입니다. 구성원 명단, 세션 일정, 출결, 점수를 한곳에서 관리합니다. 실제로 매 기수 운영에 쓰였습니다.",
      "쓰는 사람이 정해져 있는 도구라 예쁜 화면보다 틀리지 않는 입력이 중요했습니다. 운영진을 인터뷰해 실제 작업 동선을 분해하고, 그 순서대로 화면을 다시 놓았습니다.",
    ],
    features: [
      { name: "구성원 관리", body: "기수별 명단과 파트를 관리합니다." },
      { name: "일정·출결", body: "세션 일정을 만들고 출결을 기록합니다." },
      { name: "점수 관리", body: "활동 점수를 입력하고 집계합니다." },
      {
        name: "권한",
        body: "운영진만 들어옵니다. 세션이 끊기면 로그인으로 보내고 원래 자리로 돌려보냅니다.",
      },
    ],
    stack: [
      { group: "화면", items: ["React", "JavaScript", "styled-components", "Recoil"] },
      { group: "통신", items: ["Axios", "JWT"] },
      { group: "서버", items: ["Firebase → Spring Boot"] },
    ],
    notes: [
      "입력 오류율을 20% 아래로 내렸습니다. 고친 것은 검증이 아니라 순서였습니다 — 사람이 실제로 움직이는 순서와 화면의 순서가 달랐습니다.",
      "Firebase에서 Spring Boot로 넘어가며 CRUD 호출을 전면 재작성했고, 요청 처리 시간이 약 70% 줄었습니다.",
      "화면마다 제각각이던 세션 만료·권한 오류 처리를 Axios 인터셉터 한 곳으로 모았습니다. 같은 처리가 여러 벌이면 반드시 한쪽이 낡습니다.",
    ],
    shots: [],
    links: [
      { label: "바로가기", href: "https://pard-app-project.web.app" },
      { label: "코드 보기", href: "https://github.com/Club-PARD/PARD-APP-admin" },
    ],
  },
  {
    slug: "bwchef",
    kind: "실험",
    title: "흑백요리사 소개 사이트",
    tagline: "출연 셰프와 요리, 운영 식당을 모아 보는 정보 사이트",
    period: "2024.11 — 2024.12",
    status: "운영 중",
    team: "팀",
    role: "프론트엔드",
    summary: [
      "방송에 나온 셰프들의 정보가 여기저기 흩어져 있어 한 사람을 따라가기 어려웠습니다. 셰프 한 명을 기준으로 요리와 이야기, 운영하는 식당을 한 화면에 모았습니다.",
      "프레임워크 없이 순수 JavaScript로 만들었습니다. 데이터는 JSON 파일에 두고 화면이 읽어 카드를 만듭니다.",
    ],
    features: [
      { name: "셰프 카드", body: "닉네임·사진·명대사·요리 장르를 카드로 봅니다." },
      { name: "셰프 상세", body: "대표 요리와 방송에서의 이야기를 따라갑니다." },
      { name: "운영 식당", body: "식당 정보와 예약 링크를 두고, 위치는 지도로 봅니다." },
      { name: "퀴즈", body: "읽기만 하지 않게 상호작용 요소를 하나 넣었습니다." },
    ],
    stack: [
      { group: "화면", items: ["HTML", "CSS", "JavaScript"] },
      { group: "연동·배포", items: ["Kakao Map", "Netlify"] },
    ],
    shots: [],
    links: [
      { label: "바로가기", href: "https://bw-chef.netlify.app" },
      { label: "코드 보기", href: "https://github.com/Handong-TeamProject/BWChef" },
    ],
  },
  {
    slug: "hancamsa",
    kind: "실험",
    title: "한캠사",
    tagline: "한동대학교 캠퍼스를 건물 단위로 소개하는 정적 사이트",
    period: "2023.04 —",
    status: "운영 중",
    team: "팀",
    role: "프론트엔드 · 빌드 도구",
    summary: [
      "학교 캠퍼스를 처음 온 사람에게 소개하는 사이트입니다. 건물별 설명과 캠퍼스 안의 자리들을 64개 페이지로 담았습니다.",
      "페이지가 예순 개를 넘어가자 HTML을 손으로 고치는 일이 한계에 왔습니다. 그래서 외부 패키지 없이 파이썬으로 작은 템플릿 엔진과 빌드 스크립트를 만들고, 내용은 JSON으로 뺐습니다. 고칠 것이 생기면 데이터 파일 한 줄을 고치고 다시 빌드합니다.",
    ],
    features: [
      { name: "건물 소개", body: "건물마다 설명과 사진을 둡니다." },
      { name: "캠퍼스맵", body: "아이소메트릭 투영을 계산해 지도를 그립니다." },
      {
        name: "데이터와 화면 분리",
        body: "내용은 JSON, 뼈대는 템플릿. 둘을 합쳐 정적 사이트 64쪽을 만듭니다.",
      },
    ],
    stack: [
      { group: "화면", items: ["HTML", "CSS", "JavaScript"] },
      { group: "빌드", items: ["Python 3", "자체 템플릿 엔진"] },
    ],
    notes: [
      "빌드 스크립트에 외부 의존성을 두지 않았습니다. 몇 년 뒤에 다시 열었을 때 설치부터 막히면 고칠 수 없는 사이트가 됩니다. 파이썬만 있으면 돌아갑니다.",
    ],
    shots: [],
    links: [{ label: "코드 보기", href: "https://github.com/PangilProject/hancamsa2024" }],
  },
];

/** slug로 찾는다. 없으면 `undefined` — 라우트가 `notFound()`를 부른다 */
export function findProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}
