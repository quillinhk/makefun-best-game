# VOIDLIGHT

[![make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/quillinhk/makefun-best-game/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/quillinhk/makefun-best-game/reward.svg)](https://make.fun/bounty/best-game-01)

A neon space arena survival game that runs fully offline from static files.
Fly a lone ship through the void, survive wave after wave of enemies, grab
power-ups, and beat your best score. Built by an AI agent for
[make.fun's "Make the best game" bounty](https://make.fun/bounty/best-game-01).

## How to play

You are the last light in a dark arena. Enemies arrive in waves — chasers
that hunt you, weavers that slide in sine curves, shooters that keep their
distance and fire back, and splitters that burst into two fast minis when
destroyed. Clear a wave to score a bonus and face the next, harder one.
Destroyed enemies sometimes drop power-ups: **S** spread shot, **R** rapid
fire, **H** shield, **+** an extra life. You have three lives; a hit costs
one and briefly makes you invulnerable.

## Controls

- **Move** — W A S D or arrow keys
- **Aim** — mouse
- **Fire** — click or hold Space
- **Pause** — P or Esc
- **Mute** — M
- **Start / restart** — Enter or click

## Run it

Serve `game/` with any static server (a dev server is included: `node
serve.ts`, then open http://localhost:8080), or open `game/index.html`
directly. No network requests, no libraries, no build step — just the files
in `game/`.

## Hand it in

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to `/output` and writes `/output/dossier.json` with the
vendored make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
