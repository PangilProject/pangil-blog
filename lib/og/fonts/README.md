# OG 카드 폰트

satori(@vercel/og)는 **TTF/OTF/WOFF만** 읽는다 — 지면이 쓰는 woff2를 그대로 쓸 수 없어 별도
서브셋을 둔다(04 §3.5 "폰트는 서브셋 임베드").

| 파일 | 원본 | 라이선스 | 범위 | 크기 |
|------|------|----------|------|------|
| `gowun-batang-700-ks.ttf` | Gowun Batang 700 | OFL 1.1 | KS X 1001 한글 2,350자 + ASCII + 조판 기호 | ~1.3MB |
| `nanum-gothic-coding-ascii.ttf` | Nanum Gothic Coding 400 | OFL 1.1 | ASCII + 조판 기호 | ~12KB |

한글은 **KS X 1001 완성형 2,350자**까지만 싣는다. 전체 한글 음절(11,172자)을 싣으면 7.4MB가
되고, 그 범위 밖 음절이 제목에 쓰이는 일은 드물다. 만약 □로 깨지는 제목이 나오면 그때 범위를
넓힌다 — 지금은 크기가 더 비싸다.

재생성 방법(fonttools 필요, 레포에는 넣지 않는다):

```bash
# 원본은 Google Fonts에서 받는다 (css2 응답의 .ttf URL)
pyftsubset gowun-700.ttf --output-file=gowun-batang-700-ks.ttf \
  --unicodes-file=ks-hangul.txt \
  --unicodes="U+0020-007E,U+00B7,U+2018-201D,U+2026,U+2013-2014,U+00D7,U+203B" \
  --layout-features='' --no-hinting --desubroutinize

pyftsubset ngc.ttf --output-file=nanum-gothic-coding-ascii.ttf \
  --unicodes="U+0020-007E,U+00B7,U+2013-2014,U+2026" \
  --layout-features='' --no-hinting --desubroutinize
```

`ks-hangul.txt`는 EUC-KR 바이트가 `0xB0A1~0xC8FE`인 음절 목록이다(= KS X 1001 완성형 2,350자).
