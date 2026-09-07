import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

/**
 * 프로덕션 배포 (08 §2 · 260906 "배포 구조").
 *
 *   npm run release              # 검사 → 확인 → 배포
 *   npm run release -- --yes     # 확인 없이
 *   npm run release -- --dry-run # 검사만 (배포 안 함)
 *   npm run release -- --force   # CI가 실패했어도 배포
 *
 * **`main` 머지는 배포가 아니다.** Vercel Hobby는 조직 소유 private 레포의 git 연동을
 * 막으므로(프로젝트 link가 비어 있다) 배포는 손으로 돌린다. 2026-09-06에 PR 셋이 머지됐는데
 * 반나절 배포가 안 된 것을 아무도 몰랐다 — 그 절차를 한 명령으로 묶은 것이 이 스크립트다.
 *
 * 하는 일은 `git switch main && git pull && vercel --prod` 그대로다. 값은 검사에 있다:
 *
 * 1. **작업 트리가 깨끗한가** — 제일 중요하다. `vercel --prod`는 git이 아니라 **로컬 파일**을
 *    올린다. 그래서 `git pull`이 성공했어도 안 커밋한 수정이 프로덕션에 그대로 나간다.
 * 2. `main`이 `origin/main`과 같은가 — 앞서 있으면(안 푼 커밋) 멈춘다. 아무도 안 본 코드가
 *    프로덕션에 서면 그게 사고다.
 * 3. 그 커밋의 CI가 통과했는가 — `gh`가 있을 때만. 없으면 건너뛰고 그렇다고 말한다.
 *
 * 검사는 전부 **옮기기 전에** 한다. `--dry-run`이 브랜치를 벗어나게 만들면 그건 dry-run이
 * 아니다 — 처음에 그렇게 만들었다가 고쳤다.
 *
 * 마이그레이션은 여기서 돌리지 않는다. `scripts/deploy.mts`가 Vercel 빌드 안에서
 * production일 때만 돌린다 — 스키마와 코드가 한 커밋에 있어야 하기 때문이다.
 */

const YES = process.argv.includes("--yes");
const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

/** 실패를 조용히 두지 않는다. 어디서 멈췄는지와 무엇을 하면 되는지를 함께 적는다 */
function stop(message: string, hint?: string): never {
  console.error(`\n[release] 멈춥니다 — ${message}`);
  if (hint) console.error(`          ${hint}`);
  process.exit(1);
}

function run(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

/** 있으면 값, 없으면 null. 없는 것이 정상인 도구를 물을 때 쓴다 */
function tryRun(command: string, args: string[]): string | null {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function step(message: string): void {
  console.warn(`[release] ${message}`);
}

// ── 0. 저장소 루트에서 돈다 ───────────────────────────────────────────────────
// npm run은 루트에서 돌지만, 스크립트를 직접 부를 수도 있다
const root = tryRun("git", ["rev-parse", "--show-toplevel"]);
if (!root) stop("git 저장소가 아닙니다.");
process.chdir(root);

// ── 1. 작업 트리가 깨끗한가 ──────────────────────────────────────────────────
// vercel --prod는 로컬 파일을 올린다. 이 검사가 이 스크립트의 존재 이유다
const dirty = run("git", ["status", "--porcelain"]);
if (dirty !== "") {
  stop(
    "작업 트리에 커밋하지 않은 변경이 있습니다.",
    `vercel --prod는 git이 아니라 로컬 파일을 올립니다 — 그대로 프로덕션에 나갑니다.\n${dirty}`,
  );
}

// ── 2. origin/main을 읽는다 ─────────────────────────────────────────────────
// 옮기기 **전에** 가져온다. --dry-run이 브랜치를 건드리지 않아야 하기 때문이다 —
// 검사만 하려고 돌렸는데 작업 브랜치를 벗어나 있으면 그건 dry-run이 아니다
step("git fetch origin main");
run("git", ["fetch", "origin", "main"]);

const startedOn = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
if (!tryRun("git", ["rev-parse", "--verify", "main"])) {
  stop("로컬에 main 브랜치가 없습니다.", "git switch -c main origin/main 후 다시 돌리세요.");
}

const target = run("git", ["rev-parse", "origin/main"]);
const behind = Number(run("git", ["rev-list", "--count", "main..origin/main"]));
const ahead = Number(run("git", ["rev-list", "--count", "origin/main..main"]));

if (ahead > 0) {
  stop(
    `main이 origin/main보다 커밋 ${ahead}개 앞서 있습니다.`,
    "아무도 안 본 코드를 프로덕션에 세우지 않습니다. git push 먼저 하세요.",
  );
}

// ── 3. 배포할 커밋 ───────────────────────────────────────────────────────────
const sha = target;
const subject = run("git", ["log", "-1", "--format=%s", sha]);
const when = run("git", ["log", "-1", "--format=%cd", "--date=format:%Y-%m-%d %H:%M", sha]);

// ── 4. 그 커밋의 CI가 통과했는가 (gh가 있을 때만) ────────────────────────────
const checksRaw = tryRun("gh", [
  "api",
  `repos/{owner}/{repo}/commits/${sha}/check-runs`,
  "--jq",
  '.check_runs[] | "\\(.name)\\t\\(.status)\\t\\(.conclusion)"',
]);

if (checksRaw === null) {
  step("CI 상태는 확인하지 못했습니다 (gh 없음 또는 조회 실패).");
} else if (checksRaw === "") {
  step("이 커밋에는 CI 기록이 없습니다.");
} else {
  const checks = checksRaw.split("\n").map((line) => {
    const [name = "", status = "", conclusion = ""] = line.split("\t");
    return { name, status, conclusion };
  });

  const failed = checks.filter((check) =>
    ["failure", "timed_out", "cancelled", "action_required"].includes(check.conclusion),
  );
  const running = checks.filter((check) => check.status !== "completed");

  for (const check of checks) {
    step(`  CI ${check.name}: ${check.status === "completed" ? check.conclusion : check.status}`);
  }

  if (failed.length > 0 && !FORCE) {
    stop(
      `CI가 실패한 커밋입니다 (${failed.map((check) => check.name).join(", ")}).`,
      "정말 배포하려면 --force를 붙이세요.",
    );
  }

  // 도는 중인 것은 막지 않는다. 배포는 되돌릴 수 있고, 기다리는 판단은 사람의 것이다
  if (running.length > 0) {
    step(`아직 도는 검사가 ${running.length}개 있습니다.`);
  }
}

// ── 5. 확인 ──────────────────────────────────────────────────────────────────
console.warn(`
[release] 배포할 것
          ${sha.slice(0, 7)}  ${subject}
          ${when}
`);

if (DRY_RUN) {
  const plan = [
    startedOn === "main" ? null : `${startedOn} → main으로 옮기고`,
    behind === 0 ? null : `커밋 ${behind}개를 당기고`,
    "vercel --prod",
  ].filter((part) => part !== null);

  step(`--dry-run — 배포하면 ${plan.join(" ")}. 여기서 멈춥니다.`);
  process.exit(0);
}

if (!YES) {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await rl.question("[release] 프로덕션에 배포합니다. 계속할까요? (y/N) ");
  rl.close();

  if (answer.trim().toLowerCase() !== "y") stop("사용자가 취소했습니다.");
}

// ── 6. 이제 옮긴다 ───────────────────────────────────────────────────────────
if (startedOn !== "main") {
  step(`${startedOn} → main`);
  run("git", ["switch", "main"]);
}

if (behind > 0) {
  step(`git merge --ff-only origin/main (커밋 ${behind}개)`);
  try {
    run("git", ["merge", "--ff-only", "origin/main"]);
  } catch {
    stop("fast-forward로 당길 수 없습니다 — 갈라졌습니다.", "손으로 정리한 뒤 다시 돌리세요.");
  }
}

// 올릴 것이 검사한 것과 같은지 마지막으로 맞춘다 — 여기서 어긋나면 다른 코드를 올리는 것이다
const head = run("git", ["rev-parse", "HEAD"]);
if (head !== sha) {
  stop(`HEAD(${head.slice(0, 7)})가 배포하려던 커밋(${sha.slice(0, 7)})과 다릅니다.`);
}

// ── 7. 배포 ──────────────────────────────────────────────────────────────────
// npx로 부르지 않는다 — 없을 때 조용히 내려받기를 시작해서, 배포를 기다리는 줄 알고
// 앉아 있게 된다. 전역 vercel을 그대로 부르고 없으면 없다고 말한다
if (!tryRun("vercel", ["--version"])) {
  stop("vercel CLI를 찾지 못했습니다.", "npm i -g vercel 후 vercel login");
}

step("vercel --prod");
try {
  execFileSync("vercel", ["--prod"], { stdio: "inherit" });
} catch {
  stop("vercel --prod가 실패했습니다.", "위 출력에 사유가 있습니다. 프로덕션은 그대로입니다.");
}

console.warn(`
[release] 끝났습니다 — ${sha.slice(0, 7)} (${subject})
          ${startedOn === "main" ? "main에 있습니다." : `${startedOn}에서 main으로 옮겨왔습니다.`}
`);
