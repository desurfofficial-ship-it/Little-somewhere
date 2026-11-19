# LITTLE SOMEWHERE

> *A little world filled with thousands of little stories.*

**LITTLE SOMEWHERE** is a cozy isometric 3D low-poly life-simulation game built for mobile and desktop browsers using **Three.js**, **React**, **TypeScript**, and **Tailwind CSS**.

Explore a sunlit miniature neighborhood, observe nine independent neighbors living out their daily schedules, uncover branching personal stories, and watch the 3D world physically bloom and transform around your choices.

---

## Features

- **Isometric 3D Clay-Storybook World**: Handcrafted procedural multi-part cottages, greenhouse, stone fountain, wooden footbridge, Mirror Pond, and the Old Bell Gazebo with real-time Morning, Afternoon, Golden Hour, and Lantern Dusk lighting.
- **9 Living Residents with Schedules**: Clara, Arthur, Mina, Jun, Barnaby, Sora, Toby, Nora, and Pip move between cottages, workshops, and the plaza across four time phases.
- **Branching Narrative & Memories**: Build friendships (`0–5` hearts), choose how to mediate neighbors' conflicts, and record timestamped entries in your **Pocket Journal**.
- **Environmental Reactivity**: Help neighbors to bloom window-box planters, restore water to the stone fountain, clear creeping ivy off the gazebo, light plaza festoon lanterns, open bakery café tables, and ring the restored brass bell.
- **Mobile-First + Desktop Controls**:
  - **Mobile / Touch**: Virtual thumbstick, tap ground to walk, tap any resident or cottage prop to interact, bottom-docked storybook dialogue sheet.
  - **Desktop**: `WASD` / `Arrow Keys` to move, `Click` ground or neighbors, `E` to interact, `J` for Pocket Journal, `M` to mute, `Esc` / `P` to pause, mouse wheel or HUD buttons to zoom.
- **Persistent Progression**: Saves automatically to `localStorage`; rest on your porch at *Willow Step Cottage* to wake up on the next day.

---

## Quickstart

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Run pure game-engine unit tests
npm test

# TypeScript check
npm run lint

# Production build
npm run build
```

You can pass `?autostart=1` to skip the orbiting title screen and boot directly into gameplay.

---

## Repository Structure

```text
├── AGENTS.md              # Engineering rules, visual constitution, & workflow
├── ARCHITECTURE.md        # System layers, camera math, & reactivity pipeline
├── GAME_DESIGN.md         # Visual bible, 9-resident dossiers, & story graph
├── HANDOVER.md            # Current milestone status, gotchas, & next backlog
├── WORKLOG.md             # Chronological build & verification log
├── CHANGELOG.md           # Versioned release notes
├── src/
│   ├── App.tsx            # Game shell, top HUD, keyboard shortcuts, persistence
│   ├── components/        # TitleOverlay, VirtualJoystick, DialogueSheet, JournalDrawer, PauseModal
│   ├── game/              # Headless simulation, worldMap, residents, narrative, actions, storage, tests
│   └── scene/             # NeighborhoodCanvas (Three.js), composite models, procedural textures
└── index.html             # Fonts (Fraunces, Plus Jakarta Sans, JetBrains Mono) & metadata
```
