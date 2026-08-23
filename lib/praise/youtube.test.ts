import { describe, expect, it } from "vitest";

import { parseYouTubeId, youtubeEmbedUrl } from "@/lib/praise/youtube";

describe("parseYouTubeId", () => {
  it("실제로 붙여넣는 형태들을 알아본다", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ?t=42")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RD")).toBe(
      "dQw4w9WgXcQ",
    );
    // 앞뒤 공백은 붙여넣기에서 늘 생긴다
    expect(parseYouTubeId("  https://youtu.be/dQw4w9WgXcQ  ")).toBe("dQw4w9WgXcQ");
  });

  it("유튜브가 아니거나 id 규칙에 안 맞으면 null이다", () => {
    expect(parseYouTubeId("https://vimeo.com/12345")).toBeNull();
    expect(parseYouTubeId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(parseYouTubeId("https://www.youtube.com/@channel")).toBeNull();
    expect(parseYouTubeId("그냥 글자")).toBeNull();
    expect(parseYouTubeId("")).toBeNull();
  });

  it("스킴을 위조한 주소를 프레임 주소로 만들지 않는다", () => {
    expect(parseYouTubeId("javascript:alert(1)//youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("임베드 주소는 우리가 만든다 — 붙여넣은 문자열을 쓰지 않는다", () => {
    expect(youtubeEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });
});
