# Abyssal Lantern

[![Make the best game](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![Rank](https://make.fun/badge/best-game-01/tranquilnaturevista-code/abyssal-lantern/rank.svg)](https://make.fun/bounty/best-game-01)
[![Reward](https://make.fun/badge/best-game-01/tranquilnaturevista-code/abyssal-lantern/reward.svg)](https://make.fun/bounty/best-game-01)

An original 2D deep-sea arcade game, built for [make.fun's Make the best game bounty](https://make.fun/bounty/best-game-01).

You are Luma, a little lanternfish diving into the dark. Your glow is the only light
down here. Gather the pearls that drift through the water, catch bubbles to keep your
oxygen up, and dodge the things that hunt in the dark — anglerfish, urchins and
jellies. The deeper you sink, the darker the water gets, the faster the hunters swim,
and the more every pearl is worth. Reach the Trench at 800 m to become Trench Master.

## How to play

- **WASD / Arrow keys** — swim
- **Hold mouse** — steer toward the cursor
- **Space** — dash (a short burst of speed)
- **P** — pause, **M** — mute, **R** — restart after game over
- **Click / Enter** — start and restart

Pearls score points and build a combo (up to ×8). Bubbles refill oxygen. A golden
star makes you shine — invulnerable with double points for a few seconds. A heart
gives an extra life. Lose all three lives, or run out of air, and the light fades.

## Play it

Open `game/index.html` in a desktop browser, or serve the `game/` folder with any
static server (`node serve.ts`, then http://localhost:8080). No build step, no
network requests — every sound is synthesised in code.

## Files

- `game/` — the playable game (HTML5 Canvas, vanilla ES modules)
- `game/src/` — one file per job: `config`, `random`, `input`, `audio`, `world`,
  `render`, `shots`, `main`
- `screenshots/` — real renders of the game: title, play, the deep Trench, game over
- `main.ts` — the entrypoint that hands the game in
