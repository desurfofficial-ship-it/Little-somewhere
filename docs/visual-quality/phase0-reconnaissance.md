# Phase 0 — Repository Reconnaissance Report
## Mission: Eliminate Floor Flickering & Mobile Rendering Artifacts (Little Somewhere)

**Date**: 2026-11-22 · **Branch**: `fix/mobile-floor-flickering`
**Repo**: `/home/z/my-project/little-somewhere`

> Note: this report was authored against base `56ea1be` and re-validated on the re-established
> mission branch (base `7998145` = origin/main after PR #22/#23; zero source overlap in all
> mission-touched files, verified by `git diff --stat`).

---

## 1. Repository State

| Item | Finding |
| --- | --- |
| Active clone | `/home/z/my-project/little-somewhere` — clean tree at mission start, `main` fast-forwarded to `origin/main`. |
| Second directory | `/home/z/my-project/Little-somewhere` (capital L) is a **stale secondary clone** (branch `docs/visual-identity-evolution-audit`, 271 file-mode-only "changes"). Untouched by this mission. |
| Mainline | `origin/main` at mission start = `56ea1be` (PR #21; PR #15 already merged). During the mission the sandbox recycle restored an older clone snapshot; the mission was re-established on the advanced mainline `7998145` (PR #22/#23, NPC intelligence) after verifying zero source overlap. |
| Mission branch | `fix/mobile-floor-flickering`. |

## 2. Stack & Commands (verified from `package.json` / `AGENTS.md`)

- **Three.js 0.187.0**, **React 19**, **Vite 8**, **TypeScript 7.0.2**, `tsx` test runner.
- Verification gates (per `AGENTS.md` §4): `npm test`, `npm run lint` (`tsc --noEmit`), `npm run build`, live headless-Chromium checks at 1440×900 and 390×844.
- Browser QA harness: `scripts/qa_visual_baseline.sh` & siblings (`agent-browser` CLI, vite preview, `AGENT_BROWSER_SESSION`).
- Runtime debug probes: `window.__LS_PERF__`, `__LS_SCENE_STATS__`, `__LS_CAMERA_SET__/__LS_CAMERA_GET__`, `__LS_DRIFT_PROBE__`.

## 3. Rendering Architecture (actual, verified by reading code)

```
index.html → main.tsx → App.tsx (Title/Playing/Paused)
                        └── src/scene/NeighborhoodCanvas.tsx  (~3,100 lines — the monolith)
                              ├── WebGLRenderer: antialias=!isSoftwareGl, dpr=min(devicePixelRatio,2),
                              │   ACESFilmic exposure 0.98, shadowMap enabled=!isSoftwareGl
                              ├── PerspectiveCamera(28°, w/h, near=0.5, far=160) + CameraController
                              │   (orbit pitch band 26.55°–39.15°, zoom 0.55–1.75, damped target)
                              ├── Lights: Hemisphere(0.54) + Directional sun 1.52 @ (22,30,16)
                              │   castShadow=!isSoftwareGl, mapSize 1024², ortho ±28, near 4 far 85,
                              │   bias −0.0005, normalBias 0.025; rim 0.45; RoomEnvironment PMREM 0.68
                              ├── Fog 42→86 (interior 200→260)
                              └── tick() rAF loop; exteriorRoot/interiorRoot
```

**Layer law (AGENTS.md)**: `src/game/` pure TS (Node-testable, no three), `src/scene/` Three.js, `src/components/` React HUD. Zero per-frame allocations in `tick()`; `isSoftwareGl` parity.

## 4. Ground / Floor Implementation (the complaint surface)

| Element | File:Line (base) | Construction | Key metrics |
| --- | --- | --- | --- |
| Meadow ground | `NeighborhoodCanvas.tsx:573–587` | `PlaneGeometry(110,110)` flat, meadowTex 9×9 + macro lightMap via uv1 | **y=0**, receiveShadow |
| Cobble strips ×8 | `NeighborhoodCanvas.tsx:620–634` | `BoxGeometry(w, 0.06, l)` at y=0.02 (comment: "+0.02 to prevent Z-fighting") | spans **[−0.01, +0.05]**; tops exactly **+0.05**; one shared material |
| Plaza strip | `addCobbleStrip(0, 0, 12.5, 13.5)` | central plaza | fountain at (0, 0, 1.5) |
| Cobble material | L612–618 | cobbleTex 512² repeat 4×4 + roughnessMap clone 4×4 | per-face UV → density varies per strip |
| Contact shadows | `contactShadows.ts` (~98 outdoor discs) + dynamic | transparent quads, depthWrite:false, y 0.015–0.024 | **below cobble top** → occluded on plaza |
| Fountain | `builders/landmarks.ts:287–825` | lathe basin, dais 0.14/0.43/0.59, water disc y=0.62 (transparent, depthWrite default ON) | centerpiece of plaza |
| Dressing | `botanicalDressing.ts`, `reactiveProps.ts`, `vegetation.ts` | instanced pebbles/tufts; puddles y=0.058 | seeded, collision-aware |

## 5. Hot Leads Established (verified by Phase-1 agents — see the investigation report)

1. Sub-texel vertical separations (cobble 0.05 vs shadow texel 0.0547; discs 0.018 vs meadow at glancing angles).
2. Cobble boxes interpenetrate the meadow plane; strips overlap each other.
3. iOS depth-buffer reality (DEPTH_COMPONENT16 legacy edge).
4. Texture plane: 512² cobble at 4×4, per-strip UV stretch, aniso caps.
5. Camera near=0.5/far=160 — to be evaluated, not assumed.

## 6. Working Rules (locked in)

- Phase-1 agents investigated read-only; implementation on `fix/mobile-floor-flickering` only; nothing pushed/merged without user review; `docs/art-direction/*` identity law honored throughout.
