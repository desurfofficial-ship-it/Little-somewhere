# Optional Agent Skills for LITTLE SOMEWHERE

These skills **enhance** coding-agent capabilities. They are **not** architectural authorities.

**Always obey** the repository rules in `AGENTS.md`, `docs/art-direction/VISUAL_IDENTITY.md`, and the layer boundaries first. Skills may be loaded only when they help execute work that already complies with those rules.

## How agents should use these

1. Read `AGENTS.md` and the visual constitution before any visual or structural change.
2. Load a skill only when the task matches its trigger (high-fidelity visuals, sound design, reference assets, etc.).
3. Never let a skill introduce photorealism, external runtime asset packs that can fail, or collapse of the three-layer architecture.
4. Prefer the project’s procedural + CanvasTexture + Web Audio approach for shipped runtime content.

## Included / referenced skills

| Skill | Purpose | How to load |
|-------|---------|-------------|
| **dream-loop** | Closed loop for high graphical fidelity (target image → build → critic) | Local: `skills/dream-loop/SKILL.md`. Full upstream: `npx skills add achimala/dream-loop` |
| **earshot** | Generate & evaluate sound effects (UI, foley, ambience, game SFX) from words | `npx skills add Leonxlnx/earshot` then `pip install "earshot @ git+https://github.com/Leonxlnx/earshot"` |
| **MengTo/Skills** | Rich library of design, Three.js, game, and UI workflows | `npx skills add MengTo/Skills` (or clone selectively). Prefer skills under `agent-skills/3d/`, `game-development/`, `web-design/` |
| **polyhaven** | Search/download CC0 HDRIs, textures, models for **reference or optional** use | Local: `skills/polyhaven/SKILL.md`. Prefer procedural geometry for runtime. |

## Installation notes for humans

```bash
# Optional: install skills into your agent environment
npx skills add achimala/dream-loop
npx skills add Leonxlnx/earshot
npx skills add MengTo/Skills

# earshot tool itself
pip install "earshot @ git+https://github.com/Leonxlnx/earshot"
```

After installation, agents that support the skills format will discover the `SKILL.md` files. In this repository the local copies under `skills/` are the preferred entry points so agents working on LITTLE SOMEWHERE see the project-specific guidance first.

## Governance

- Skills may suggest techniques, prompts, and tooling.
- They may **not** redefine visual identity, storage keys, schedule systems, or verification gates.
- When a skill conflicts with `AGENTS.md` or the art-direction docs, `AGENTS.md` wins.
