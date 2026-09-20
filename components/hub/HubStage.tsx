"use client";

import { useEffect, useRef } from "react";

/**
 * 허브 연출 (ADR-004 2단계) — **공개 아일랜드 7번째이자 허브의 유일한 아일랜드**.
 *
 * 04 §3.6이 이 예산을 "늘 때마다 한 번 묻는다"로 두었고 ADR-004가 그 물음이었다. 조건이
 * 하나 붙었다: **진행률·색 보간·활자 물리·커서를 컴포넌트 넷으로 흩지 않는다.** 그래서
 * 이 파일 하나가 네 가지를 전부 한다 — 흩어지면 예산은 숫자만 남고 뜻이 사라진다.
 *
 * **이 층이 없어도 지면은 완성돼 있다.** 서버가 그린 골격이 이미 읽히고, 장면은 `data-scene`
 * 정적 토큰으로 갈려 있다(1단계). 여기서 하는 일은 그 위에 시간축을 얹는 것뿐이고,
 * `prefers-reduced-motion`에서는 **아무것도 하지 않고 끝난다**.
 *
 * 하는 일 넷:
 * 1. 스크롤 진행률을 `--hub-progress`로 노출한다
 * 2. 장면 사이 색을 연속 보간한다 — 단, **배경만 보간하고 글자색은 그 배경에서 역산한다**
 * 3. 첫 문장의 활자에 중력을 건다. 스크롤이 중력 방향을 한 바퀴 돌린다
 * 4. 커서가 지나간 자리에 잉크가 남았다 마른다 (Canvas 2D)
 *
 * 의존성 0개. three.js도 애니메이션 라이브러리도 쓰지 않는다 — 점 몇백 개와 글자 수십 개로
 * 끝나는 일에 씬그래프를 들이지 않는다(ADR-004 대가 #4).
 */
export function HubStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) {
      // 줄여 달라고 한 사람에게는 이 층이 아예 서지 않는다. 골격이 그대로 폴백이다.
      // 진행 막대와 상태 표시도 걷는다 — 갱신되지 않으면 0에서 굳은 채 남는다
      canvas.hidden = true;
      if (railRef.current) railRef.current.hidden = true;
      if (hudRef.current) hudRef.current.hidden = true;
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /**
     * 커서가 없는 기기에서는 잉크 자국을 그리지 않는다.
     * 손가락은 화면 위를 떠다니지 않으므로 자국이 **누른 자리에만 툭툭 찍히고**,
     * 그 그림을 위해 배터리를 쓰는 rAF 루프가 계속 돈다. 스크롤 연출은 그대로 남는다.
     */
    const hasHover = window.matchMedia("(hover: hover)").matches;
    if (!hasHover) canvas.hidden = true;

    /* ── 색 ────────────────────────────────────────────
       기준색은 토큰에서 읽는다. 여기에 값을 적으면 다크 모드에서 어긋나고,
       하드코딩 색 가드(lib/site/hardcodedColors.test.ts)에도 걸린다 */
    type RGB = [number, number, number];
    const readToken = (name: string): RGB => {
      const raw = getComputedStyle(root).getPropertyValue(name).trim().replace("#", "");
      const hex = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;
      const n = Number.parseInt(hex, 16);
      return Number.isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const css = (c: RGB) => `rgb(${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])})`;
    const mix = (a: RGB, b: RGB, t: number): RGB => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
    const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const channel = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (c: RGB) =>
      0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
    const ratio = (a: RGB, b: RGB) => {
      const la = luminance(a);
      const lb = luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    /**
     * 배경과 글자를 서로 크로스페이드하면 중간에서 두 색이 같은 회색으로 만난다(실측 3.0:1).
     * 그래서 **글자는 배경에서 역산한다** — 색상은 지키고 명도만 흑/백 쪽으로 밀어 목표를 채운다.
     */
    const ensure = (fg: RGB, bg: RGB, target: number): RGB => {
      if (ratio(fg, bg) >= target) return fg;
      const goal: RGB = luminance(bg) > 0.4 ? [14, 12, 10] : [250, 247, 240];
      for (let t = 0.05; t <= 1.0001; t += 0.05) {
        const c = mix(fg, goal, t);
        if (ratio(c, bg) >= target) return c;
      }
      return goal;
    };
    /** 중간 회색에 머무르지 않게 좁은 구간에서 건너뛴다 */
    const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

    let basePaper = readToken("--paper");
    let baseInk = readToken("--ink");
    let baseFaith = readToken("--accent-faith");
    let baseDev = readToken("--accent-dev");
    let currentPaper: RGB = basePaper;
    let currentAccent: RGB = baseFaith;

    /** JS가 칠한 값들. 기준색을 다시 읽을 때 이것부터 걷어내야 한다 */
    const PAINTED = [
      "--paper",
      "--ink",
      "--ink-soft",
      "--faint",
      "--edge",
      "--accent",
      "--hub-halo",
    ];

    /**
     * :root의 **기준색**을 읽는다. 두 가지를 걷어내고 읽어야 한다:
     * 1. 이미 칠해 둔 인라인 값 — 안 걷으면 **자기가 칠한 색을 기준색으로 오인한다**
     *    (테마를 바꿀 때마다 기준이 한 단계씩 밀린다)
     * 2. 장면 토큰 — `data-hub-live`를 잠시 풀어 폴백 블록이 끼어들지 않게 한다
     */
    const readBase = () => {
      const live = root.hasAttribute("data-hub-live");
      for (const name of PAINTED) root.style.removeProperty(name);
      root.removeAttribute("data-hub-live");

      basePaper = readToken("--paper");
      baseInk = readToken("--ink");
      baseFaith = readToken("--accent-faith");
      baseDev = readToken("--accent-dev");

      if (live) root.setAttribute("data-hub-live", "");
    };

    const paint = (tone: number, hue: number) => {
      const t = clamp(tone);
      const lightSide = mix(basePaper, mix(basePaper, baseInk, 0.2), clamp(t / 0.46));
      const darkSide = mix(mix(baseInk, basePaper, 0.13), baseInk, clamp((t - 0.54) / 0.46));
      const paper = mix(lightSide, darkSide, smoother(clamp((t - 0.46) / 0.08)));
      const dark = luminance(paper) < 0.4;
      const ink = ensure(dark ? basePaper : baseInk, paper, 9);
      const accent = ensure(mix(baseFaith, baseDev, clamp(hue)), paper, 4.8);

      currentPaper = paper;
      currentAccent = accent;

      root.style.setProperty("--paper", css(paper));
      root.style.setProperty("--ink", css(ink));
      root.style.setProperty("--ink-soft", css(ensure(mix(ink, paper, 0.3), paper, 5.4)));
      root.style.setProperty("--faint", css(ensure(mix(ink, paper, 0.46), paper, 4.6)));
      root.style.setProperty("--edge", css(mix(paper, ink, 0.22)));
      root.style.setProperty("--accent", css(accent));
      // 건너뛰는 몇 프레임 동안만 글자 뒤에 얇은 테를 켠다
      if (ratio(ink, paper) < 5.5) {
        const halo = luminance(ink) > 0.5 ? "0,0,0" : "255,255,255";
        root.style.setProperty(
          "--hub-halo",
          `0 0 3px rgba(${halo},.9), 0 0 8px rgba(${halo},.6), 0 0 16px rgba(${halo},.35)`,
        );
      } else {
        root.style.setProperty("--hub-halo", "none");
      }
    };

    /* ── 장면 ────────────────────────────────────── */
    const scenes = Array.from(document.querySelectorAll<HTMLElement>("[data-hub-scene]"));
    const tones = scenes.map((el) => Number(el.dataset.tone ?? 0));
    const hues = scenes.map((_, i) => (scenes.length > 1 ? i / (scenes.length - 1) : 0));

    /* ── 머무는 구간 ──────────────────────────────
       화면이 고정된 동안 스크롤이 어느 항목을 가리키는지 정한다(ADR-004 결정 2) */
    const tracks = Array.from(document.querySelectorAll<HTMLElement>("[data-hub-track]")).map(
      (el) => ({
        el,
        steps: Array.from(el.querySelectorAll<HTMLElement>("[data-hub-step]")),
        ticks: Array.from(el.querySelectorAll<HTMLElement>("[data-hub-tick]")),
        active: -1,
      }),
    );

    const updateTracks = () => {
      for (const track of tracks) {
        const count = track.steps.length;
        if (count === 0) continue;

        const rect = track.el.getBoundingClientRect();
        const span = track.el.offsetHeight - window.innerHeight;
        const progress = span > 0 ? clamp(-rect.top / span) : rect.top <= 0 ? 1 : 0;
        // 마지막 항목이 화면을 떠나기 전에 한 칸 머물도록 끝을 조금 남긴다
        const index = Math.min(count - 1, Math.floor(progress * count));

        // 글자가 있는 항목이면 **이 항목 안에서 얼마나 왔는지**가 모이는 정도가 된다.
        // 앞 55%에서 다 앉는다 — 나머지는 읽으라고 두는 시간이다
        const found = glyphsByStep.get(track.steps[index]);
        if (found) {
          activeGlyphs = found;
          settle = clamp((progress * count - index) / 0.55);
        }

        if (index === track.active) continue;

        track.active = index;
        for (let i = 0; i < count; i++) {
          track.steps[i].dataset.on = i === index ? "1" : "0";
        }
        for (let i = 0; i < track.ticks.length; i++) {
          track.ticks[i].dataset.on = i <= index ? "1" : "0";
        }
        if (track.el.dataset.hubScene === "tools") {
          for (const item of marqueeItems) {
            const at = Number(item.dataset.hubMqItem);
            const gap = Math.abs(at - index);
            item.dataset.on = gap === 0 ? "1" : "0";
            item.dataset.near = gap === 1 ? "1" : "0";
          }
        }
      }
    };

    /* ── 활자 낙하 ──────────────────────────────────
       **스크롤 위치가 곧 모이는 정도다.** 문장이 들어올 때 낱자는 화면에 흩어져 있고,
       내려갈수록 제자리로 앉는다. 되돌려 올리면 다시 흩어진다 — 한 번 튕기고 마는 물리는
       스크롤과 무관하게 끝나 버려서, 스크롤하는 사람이 그 연출의 주인이 되지 못한다.

       흩어지는 자리는 **낱자 번호로 정해진다**(고정 시드). 새로 고칠 때마다 달라지면
       같은 지면이 매번 다른 모양이 된다. */
    const spread = (seed: number) => {
      const wave = Math.sin(seed * 127.1) * 43758.5453;
      return wave - Math.floor(wave);
    };

    type Glyph = {
      el: HTMLElement;
      /** 흩어진 자리 */
      dx: number;
      dy: number;
      rot: number;
      /** 커서가 민 만큼 — 흩어짐과 따로 들고 있다가 CSS에서 더한다 */
      mx: number;
      my: number;
      mr: number;
      vx: number;
      vy: number;
      vr: number;
    };

    /**
     * 흩어지는 폭은 **화면에서 뽑는다.** 값을 박아 두면 폰에서는 글자가 무대 밖으로 나가
     * 흩어진 줄도 모른 채 사라지고, 큰 화면에서는 겨우 흔들리다 만다.
     */
    const reachX = () => Math.min(300, window.innerWidth * 0.34);
    const reachY = () => Math.min(170, window.innerHeight * 0.18);

    const glyphsByStep = new Map<HTMLElement, Glyph[]>();
    for (const step of Array.from(document.querySelectorAll<HTMLElement>("[data-hub-step]"))) {
      const found = Array.from(step.querySelectorAll<HTMLElement>("[data-hub-glyph]"));
      if (found.length === 0) continue;
      glyphsByStep.set(
        step,
        found.map((el, i) => ({
          el,
          dx: (spread(i + 1) * 2 - 1) * reachX(),
          dy: (spread(i + 41) * 2 - 1) * reachY() - reachY() * 0.4,
          rot: (spread(i + 97) * 2 - 1) * 58,
          mx: 0,
          my: 0,
          mr: 0,
          vx: 0,
          vy: 0,
          vr: 0,
        })),
      );
    }

    /** 지금 글자를 그리는 항목과, 그 항목 안에서 얼마나 앉았는지 */
    let activeGlyphs: Glyph[] | null = null;
    let settle = 1;
    let glyphsVisible = false;

    /* ── 활자 마퀴 ──────────────────────────────── */
    const marqueeRows = Array.from(document.querySelectorAll<HTMLElement>("[data-hub-mq-row]")).map(
      (el, i) => ({
        el,
        // 줄마다 방향이 반대라 서로 스쳐 지나간다. 속도와 시작 위치도 어긋나게 둔다 —
        // 셋이 같으면 세 줄이 한 덩어리로 보인다
        direction: i % 2 === 0 ? 1 : -1,
        speed: 1.9 + i * 0.55,
        offset: i * 0.37,
      }),
    );
    const marqueeItems = Array.from(document.querySelectorAll<HTMLElement>("[data-hub-mq-item]"));

    /* ── 발행 수 세기 ──────────────────────────────
       숫자가 0에서 올라간다. **화면에 들어올 때 한 번**이다 — 스크롤할 때마다 다시 세면
       읽으려는 사람을 방해한다.

       **React가 관리하는 노드에 속성을 쓰지 않는다.** 이 숫자는 `Suspense` 안에서 나중에
       스트리밍으로 오는데, 하이드레이트하기 전에 DOM을 갈면 서버와 어긋난다(실제로 그랬다).
       여기서 만지는 것은 글자뿐이고, 무엇을 이미 셌는지는 이 안의 집합이 기억한다.

       달력이 나타나는 연출은 JS를 쓰지 않는다 — 스크롤 타임라인 CSS가 맡는다(globals.css). */
    const COUNT_SELECTOR = "[data-hub-count]";
    const counted = new WeakSet<HTMLElement>();

    const counters = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          counters.unobserve(el);
          if (counted.has(el)) continue;
          counted.add(el);

          const target = Number(el.dataset.hubCount ?? 0);
          if (!Number.isFinite(target) || target <= 0) continue;

          const started = performance.now();
          const step = (now: number) => {
            const p = Math.min(1, (now - started) / 1500);
            // 끝에서 천천히 멎는다. 숫자가 딱 떨어지는 순간이 보여야 한다
            const eased = 1 - (1 - p) ** 3;
            el.textContent = Math.round(target * eased).toLocaleString();
            if (p < 1) requestAnimationFrame(step);
          };
          el.textContent = "0";
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.35 },
    );

    const watchCounters = (root: ParentNode) => {
      for (const el of Array.from(root.querySelectorAll<HTMLElement>(COUNT_SELECTOR))) {
        if (!counted.has(el)) counters.observe(el);
      }
    };

    watchCounters(document);

    // 늦게 흘러드는 숫자도 지켜본다. 관찰만 하고 DOM은 건드리지 않으므로 하이드레이션과 부딪히지 않는다
    const lateArrivals = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of Array.from(record.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches(COUNT_SELECTOR) && !counted.has(node)) counters.observe(node);
          watchCounters(node);
        }
      }
    });
    lateArrivals.observe(document.body, { childList: true, subtree: true });

    /* ── 커서 ────────────────────────────────────── */
    const pointer = { x: -9999, y: -9999, active: false, px: -9999, py: -9999 };
    const drops: { x: number; y: number; vx: number; vy: number; r: number; life: number }[] = [];
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;

      // 기기를 눕히면 무대 크기가 달라진다. 흩어지는 자리는 같은 시드를 다시 재어 잡는다
      for (const list of glyphsByStep.values()) {
        list.forEach((glyph, i) => {
          glyph.dx = (spread(i + 1) * 2 - 1) * reachX();
          glyph.dy = (spread(i + 41) * 2 - 1) * reachY() - reachY() * 0.4;
        });
      }

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onPointerMove = (e: PointerEvent) => {
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      const vx = pointer.x - pointer.px;
      const vy = pointer.y - pointer.py;
      const speed = Math.min(60, Math.hypot(vx, vy));
      if (hasHover && drops.length < 140) {
        drops.push({
          x: pointer.x + (Math.random() * 8 - 4),
          y: pointer.y + (Math.random() * 8 - 4),
          vx: vx * 0.06 + (Math.random() - 0.5) * 0.8,
          vy: vy * 0.06 + (Math.random() - 0.5) * 0.8,
          r: 1 + speed * 0.05 + Math.random() * 1.2,
          life: 0.4 + Math.random() * 0.28,
        });
      }
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };

    /* ── 스크롤 ──────────────────────────────────
       **`scroll` 이벤트에 기대지 않는다.** iOS는 손가락을 뗀 뒤 미끄러지는 동안 이 이벤트를
       고르게 주지 않는다 — 붙들기는 CSS라 화면은 멈춰 서는데 항목 교체만 안 따라와서,
       폰에서는 "고정된 채 아무 일도 안 일어나는" 지면이 된다. 실제로 그렇게 보였다.

       그래서 **그리는 루프가 매 프레임 스크롤 위치를 직접 읽는다.** 값이 그대로면 바로 빠진다. */
    let lastScrollY = Number.NaN;

    const syncScroll = (force = false) => {
      const scrolled = window.scrollY;
      if (!force && scrolled === lastScrollY) return;
      lastScrollY = scrolled;

      {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const progress = max > 0 ? clamp(scrolled / max) : 0;
        root.style.setProperty("--hub-progress", progress.toFixed(4));

        // 화면 한가운데가 어느 장면에 있는지로 색을 정한다.
        // 장면 끝 30%에서만 다음 장면으로 넘어간다 — 장면마다 자기 색으로 서 있는 구간이 있어야 한다
        const mid = window.innerHeight * 0.5;
        let index = 0;
        let local = 0;
        for (let i = 0; i < scenes.length; i++) {
          const rect = scenes[i].getBoundingClientRect();
          if (rect.top <= mid && rect.bottom > mid) {
            index = i;
            local = clamp((mid - rect.top) / Math.max(1, rect.height));
            break;
          }
          if (rect.top > mid) break;
          index = i;
          local = 1;
        }
        const hud = hudRef.current;
        if (hud) {
          const pct = hud.querySelector("[data-hub-hud-pct]");
          if (pct) pct.textContent = String(Math.round(progress * 100)).padStart(2, "0");
          const name = hud.querySelector("[data-hub-hud-scene]");
          const slug = scenes[index]?.querySelector("[data-hub-slug]")?.textContent;
          if (name && slug && name.textContent !== slug) name.textContent = slug;
        }

        const blend = clamp((local - 0.7) / 0.3);
        const next = Math.min(scenes.length - 1, index + 1);
        paint(
          tones[index] + (tones[next] - tones[index]) * blend,
          hues[index] + (hues[next] - hues[index]) * blend,
        );

        updateTracks();

        // 활자 마퀴 — 스크롤이 위치다. 한 벌을 두 번 이어 붙였으므로 0~1이 정확히 한 바퀴고,
        // **폭을 잴 필요가 없다** — 재서 계산하던 동안 gap 때문에 한 바퀴가 어긋났다
        for (const row of marqueeRows) {
          const raw = progress * row.speed * row.direction + row.offset;
          row.el.style.setProperty("--mq-p", (((raw % 1) + 1) % 1).toFixed(5));
        }

        const sentence = scenes.find((el) => el.dataset.hubScene === "sentence");
        if (sentence) {
          const rect = sentence.getBoundingClientRect();
          glyphsVisible = rect.bottom > -200 && rect.top < window.innerHeight + 200;
        }
      }
    };

    /* ── 한 루프 ─────────────────────────────────── */
    let running = true;
    let visible = true;
    const onVisibility = () => {
      visible = !document.hidden;
    };

    /** 지나간 자리에 잉크가 남았다 마른다 — 종이색으로 덮어 말린다 */
    const drawInk = () => {
      ctx.fillStyle = `rgba(${Math.round(currentPaper[0])},${Math.round(currentPaper[1])},${Math.round(currentPaper[2])},0.16)`;
      ctx.fillRect(0, 0, width, height);

      const [ar, ag, ab] = currentAccent;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.life -= 0.016;
        if (d.life <= 0) {
          drops.splice(i, 1);
          continue;
        }
        d.x += d.vx;
        d.y += d.vy;
        d.vx *= 0.94;
        d.vy *= 0.94;
        ctx.fillStyle = `rgba(${Math.round(ar)},${Math.round(ag)},${Math.round(ab)},${(Math.min(1, d.life) * 0.2).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * (1 + (1 - d.life) * 1.1), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const frame = () => {
      if (!running) return;
      requestAnimationFrame(frame);
      if (!visible) return;

      // 스크롤은 여기서 읽는다. 이벤트가 늦거나 건너뛰어도 연출은 화면과 어긋나지 않는다
      syncScroll();

      // 잉크 자국은 커서가 있는 기기에서만 그린다
      if (hasHover) drawInk();

      // 활자 — 스크롤이 정한 만큼 흩어져 있고, 그 위에 커서가 민 만큼을 더한다
      if (glyphsVisible && activeGlyphs) {
        // 처음엔 크게, 끝에서 아주 천천히 0으로. 앉는 순간이 보여야 한다
        const away = (1 - settle) ** 3;

        for (const glyph of activeGlyphs) {
          if (pointer.active) {
            const rect = glyph.el.getBoundingClientRect();
            if (rect.width) {
              const dx = rect.left + rect.width / 2 - pointer.x;
              const dy = rect.top + rect.height / 2 - pointer.y;
              const dist = Math.hypot(dx, dy);
              if (dist < 140 && dist > 0.5) {
                const f = (1 - dist / 140) ** 2 * 2.2;
                glyph.vx += (dx / dist) * f;
                glyph.vy += (dy / dist) * f;
                glyph.vr += (dx / dist) * f * 0.4;
              }
            }
          }

          // 밀린 것은 늘 0으로 돌아온다
          glyph.vx += -glyph.mx * 0.09;
          glyph.vy += -glyph.my * 0.09;
          glyph.vr += -glyph.mr * 0.1;
          glyph.vx *= 0.86;
          glyph.vy *= 0.86;
          glyph.vr *= 0.86;
          glyph.mx += glyph.vx;
          glyph.my += glyph.vy;
          glyph.mr += glyph.vr;

          const style = glyph.el.style;
          style.setProperty("--px", `${(glyph.dx * away).toFixed(2)}px`);
          style.setProperty("--py", `${(glyph.dy * away).toFixed(2)}px`);
          style.setProperty("--pr", `${(glyph.rot * away).toFixed(2)}deg`);
          style.setProperty("--mx", `${glyph.mx.toFixed(2)}px`);
          style.setProperty("--my", `${glyph.my.toFixed(2)}px`);
          style.setProperty("--mr", `${glyph.mr.toFixed(2)}deg`);
        }
      }
    };

    /* ── 넘침 진단 (개발 전용) ──────────────────────
       화면을 직접 볼 수 없는 기기에서 **무엇이 폭을 넘기는지** 그 자리에서 알려준다.
       `?debug=1`을 붙였을 때만 서고, 배포 빌드에는 들어가지 않는다. */
    let debugPanel: HTMLElement | null = null;
    if (process.env.NODE_ENV !== "production") {
      const wantsDebug = new URLSearchParams(window.location.search).has("debug");
      if (wantsDebug) {
        debugPanel = document.createElement("pre");
        debugPanel.style.cssText = [
          "position:fixed",
          "left:0",
          "right:0",
          "top:0",
          "z-index:99",
          "margin:0",
          "padding:8px 10px",
          "max-height:45svh",
          "overflow:auto",
          "background:#111",
          "color:#0f0",
          "font:11px/1.5 ui-monospace,monospace",
          "white-space:pre-wrap",
        ].join(";");
        document.body.appendChild(debugPanel);

        const report = () => {
          if (!debugPanel) return;
          const limit = document.documentElement.clientWidth;
          const rows: string[] = [
            `화면 ${limit}px · 문서 ${document.documentElement.scrollWidth}px`,
            `가로 스크롤 ${document.documentElement.scrollWidth > limit ? "있음" : "없음"}`,
            "─ 폭을 넘기는 것 ─",
          ];

          const guilty: { name: string; right: number; width: number }[] = [];
          for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
            if (el === debugPanel) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0) continue;
            if (rect.right <= limit + 1 && rect.left >= -1) continue;
            const name =
              el.tagName.toLowerCase() +
              (el.id ? `#${el.id}` : "") +
              (el.dataset.hubScene ? `[scene=${el.dataset.hubScene}]` : "") +
              (el.hasAttribute("data-hub-marquee") ? "[marquee]" : "") +
              (el.hasAttribute("data-hub-mq-row") ? "[mq-row]" : "") +
              (el.hasAttribute("data-hub-steps") ? "[steps]" : "") +
              (el.className && typeof el.className === "string"
                ? `.${el.className.split(" ").slice(0, 2).join(".")}`
                : "");
            guilty.push({ name, right: Math.round(rect.right), width: Math.round(rect.width) });
          }

          guilty.sort((a, b) => b.right - a.right);
          for (const item of guilty.slice(0, 12)) {
            rows.push(`${item.right}px 끝 · ${item.width}px 폭 · ${item.name}`);
          }
          if (guilty.length === 0) rows.push("(없음)");

          debugPanel.textContent = rows.join("\n");
        };

        report();
        window.addEventListener("resize", report, { passive: true });
        setTimeout(report, 1200); // 늦게 오는 조각까지 본 뒤 한 번 더
      }
    }

    /* ── 시작 ────────────────────────────────────── */
    readBase();
    root.setAttribute("data-hub-live", "");
    resize();
    syncScroll(true);
    requestAnimationFrame(frame);

    const onThemeChange = () => {
      readBase();
      syncScroll(true);
    };
    const themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(root, { attributes: true, attributeFilter: ["class"] });

    // 화면이 바뀌면 크기를 다시 재고 곧장 한 번 맞춘다
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("resize", () => syncScroll(true), { passive: true });
    window.addEventListener("orientationchange", () => syncScroll(true), { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      themeObserver.disconnect();
      counters.disconnect();
      lateArrivals.disconnect();
      debugPanel?.remove();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeAttribute("data-hub-live");
      for (const name of [...PAINTED, "--hub-progress"]) {
        root.style.removeProperty(name);
      }
      for (const track of tracks) {
        for (const step of track.steps) step.removeAttribute("data-on");
        for (const tick of track.ticks) tick.removeAttribute("data-on");
      }
      for (const row of marqueeRows) row.el.style.removeProperty("--mq-p");
      for (const item of marqueeItems) {
        item.removeAttribute("data-on");
        item.removeAttribute("data-near");
      }
      for (const list of glyphsByStep.values()) {
        for (const glyph of list) {
          for (const name of ["--px", "--py", "--pr", "--mx", "--my", "--mr"]) {
            glyph.el.style.removeProperty(name);
          }
        }
      }
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      />
      {/*
        머무는 구간에서는 화면이 고정되므로 **어디쯤인지 알 길이 없다** —
        스크롤바만으로는 "멈춘 것"과 "머무는 것"이 구분되지 않는다.
      */}
      <div ref={railRef} data-hub-rail aria-hidden>
        <i />
      </div>
      <p ref={hudRef} data-hub-hud aria-hidden>
        <span data-hub-hud-scene>조판</span>
        <b data-hub-hud-pct>00</b>
      </p>
    </>
  );
}
