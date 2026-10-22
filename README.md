# Squiggles

*by Hallucinated Games*

A glyph-drawing defense game grown from a ballpoint doodle: a stepped ziggurat with a shrine on top, a toothed sun in the corner, trails of circles, hatching, spirals, and meanders.

Stray scribbles drift and crawl toward Blot, the ink blob living in the temple. Each scribble wears a stack of glyphs. Draw the front glyph anywhere on the page to strip it from **every** scribble wearing it; strip all of them and the scribble gets crossed out.

- **Glyphs** unlock wave by wave: Pillar, Rule, Peak, Ring, Pyramid, Sawtooth, Swirl, Hatch, Block, Meander.
- **Streaks and multi-hits** score more. Hitting several scribbles with one stroke charges the corner sun.
- **Inkburst:** when the sun is full, tap it to strip one glyph from every scribble.
- **The Maze** (the square spiral from the sketch) arrives every fifth wave, carrying ten glyphs and spawning hatchlings.
- Blot has five drops of ink. A scribble that reaches the temple costs one; every third clean page restores one.

## Run it

Open `index.html` in a browser. No build step; mouse, pen and touch all work. The Hallucinated Games studio intro plays first; click, tap or press a key to skip it, or add `?nointro` to the URL.

## Files

- `index.html` – page, menus, styles
- `game.js` – game loop, hand-drawn renderer (jittered "boiling" lines), WebAudio sound
- `intro/hallucinated-intro.js` – the shared Hallucinated Games studio intro
- `recognizer.js` – stroke recognizer: resampled template matching plus corner-count and axis-alignment features
