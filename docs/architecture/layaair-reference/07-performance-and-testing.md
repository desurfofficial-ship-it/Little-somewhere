# 07 — Performance and Testing

## LayaAir Practices (Observed)

- Engine-level performance statistics and profiling hooks.
- Attention to batching, LOD, static batching, and resource lifetime.
- Component enable/disable as a cost-control mechanism.
- Platform-specific considerations (mini-games, native).

Exact internal profiler APIs and regression suites are only partially visible in the open tree; treat detailed claims as Study.

## LITTLE SOMEWHERE Practices (Inspected)

- Strong pure-function unit tests across `src/game/` (navigation, interiors, dialogue, relationships, migrations, occupancy, etc.).
- Explicit zero-GC / low-allocation rules inside per-frame paths (`rig.update`, tick handlers).
- Software-WebGL afterDraw pacing and shared material / InstancedMesh discipline.
- Contract tests that keep data obstacles and visual geometry in sync.
- CI-oriented budgets appear in related project history; mobile-first constraints are first-class.

## Classification & Recommendations

| Practice | Classification | Action |
|----------|----------------|--------|
| Component enable/disable for cost | B | When adding optional systems, prefer explicit enable flags over always-on work. |
| Profiling discipline | A (Adopt mindset) | Continue measuring frame time and allocations on target devices (390×844 and desktop). |
| Pure unit tests for simulation | A (already strong) | Keep and expand; never move core logic into untestable scene code. |
| Regression tests for movement / interiors | A | Maintain the dual-contract tests; they prevent the furniture-trap class of bugs. |
| Engine-level automated visual regression | C | Nice-to-have; not required for current scale. |

## Scalability Notes

Current design supports the existing ~10 residents + props comfortably. Future growth should:
- Budget agent updates (not every resident needs full logic every frame).
- Keep obstacle queries cheap (spatial hash only if node count grows significantly).
- Preserve the headless pure core so performance tests remain simple.

## Risks

Premature adoption of heavy engine systems would raise the performance floor and make the mobile experience worse. Prefer measured, incremental improvements inside the existing architecture.
