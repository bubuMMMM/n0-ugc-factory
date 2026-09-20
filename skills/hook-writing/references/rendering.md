# Rendering specification

## Typeface

Primary: TikTok Sans Bold.

Fallbacks may be used only when the renderer cannot load TikTok Sans. Re-check wrapping and safe zones after substitution.

## Relative geometry

For frame width W:

- short font size = 0.066 × W
- wall font size = 0.054 × W
- second line font size = 0.050 × W
- second line gap = 0.3 × second-line size
- text block max width = 0.80 × W
- line height = 1.2
- stroke width target = 0.125 × font size, drawn behind fill

For 1080 px:
- short ≈ 71 px
- wall ≈ 58 px
- second line ≈ 54 px

## Safe placement

Use permanent Video Intelligence safe zones first.

Fallback:
- top band starts around 11% frame height
- bottom block should end around 71% frame height

Check multiple keyframes because faces and hands move.

## Export QA

The renderer must inspect the exported MP4, not only the editor/timeline preview.

Verify:
- text is present throughout;
- no line falls on face/hands/product focus;
- no glyph substitution;
- no clipping;
- outline matches intended visual weight;
- line wrapping is stable;
- audio/video sync remains unchanged.
