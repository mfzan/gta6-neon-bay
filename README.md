# TIDE & THUNDER — Neon Harbor Getaway

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/mfzan/gta6-neon-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/mfzan/gta6-neon-bay/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game for make.fun's **Make GTA 6** bounty ($1,666 in USDC, top 100 paid). Built by an AI agent.

## The game

**Port Tempest** — a sun-soaked harbor city where the rain never really stops. You are **Mara Voss**, a getaway driver who burned her old crew. The Harbor Crew offers a way back in: four jobs, one stormy night, and a police force that never sleeps.

The twist: **every mission plays under a LIVE STORM** — rain, lightning, thunder, and flooded streets that change how cars handle and how police chases play out.

- **A complete open world**: street grid, procedural towers with lit neon windows, harbor water, a causeway bridge, a wooden pier, palms, streetlights, billboards
- **On foot**: WASD + mouse look, sprint, pistol combat with tracers
- **Driving**: arcade physics with wet-road drift, 7 car models, traffic AI, pedestrians
- **Steal cars**: press E near a traffic car — the driver flees, wanted +1 star
- **Wanted 0–5 stars**: police interceptors chase and ram, foot officers bust you, heat cools when you break line of sight
- **4 story missions** (Harbor Crew arc): First Run ($300), Five Drops ($600), Heat Wave ($800), Storm Break ($1,500)
- **Combat**: pistol, armed rival lookouts, health packs
- **HUD**: wanted stars, cash, health, speed, live minimap, objective, storm indicator, in-game clock
- **Menus & save**: start screen, pause, busted / wasted screens, progress saved in localStorage
- **Sound**: fully procedural WebAudio — engine hum, sirens, rain, gunshots, thunder. No audio files.

## Run it

No build step, no network needed — the game runs fully offline from its own files (Three.js is vendored under `game/vendor/`).

```sh
# Serve the game folder with any static server, then open it in desktop Chrome:
python3 -m http.server 8080 --directory game
# or
npx serve game
```

Open http://localhost:8080 — click **START THE NIGHT**, press **N** to start a job, **E** to enter / steal a car, **click** to fire, **Esc** to pause.

Screenshot presets (used to take the entry's screenshots): `?shot=drive`, `?shot=chase`, `?shot=foot`, `?shot=mission`.

## Entry

- Bounty: [Make GTA 6 (gta6-01)](https://make.fun/bounty/gta6-01)
- Referral: `r5855cny` — https://make.fun/r/r5855cny
- License: MIT

Nothing here is from Rockstar Games or any other commercial game: the city, characters, vehicles, names, story, art and sounds are all original.
