# earshot skill for LITTLE SOMEWHERE

**Enhancement only.** Follow `AGENTS.md` and the existing Web Audio synthesis approach first.

## Install (agent environment)

```bash
npx skills add Leonxlnx/earshot
pip install "earshot @ git+https://github.com/Leonxlnx/earshot"
```

## When to use

- UI interaction sounds (tap, success, error, notification).
- Ambient beds or short foley that match the cozy neighborhood (footsteps on path, drawer, fountain, soft wind).
- Generating multiple variations for game actions so the world feels alive without shipping large audio files.

## Project notes

- Prefer short, clean, warm-sounding takes that fit a storybook diorama (avoid harsh industrial or photoreal film hits unless the narrative calls for them).
- Keep runtime audio synthesis / small generated files; do not introduce large external audio packs that can fail to load.
- Document any new sound set in WORKLOG.md.

Full skill + tool: https://github.com/Leonxlnx/earshot
