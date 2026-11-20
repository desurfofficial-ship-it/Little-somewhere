# 12 — Risks and Mitigations

## 12.1 Identity Drift

**Risk**: Invitations become daily chores or friendship feels like a grind.  
**Mitigation**: Single active invitation, multi-day offer spacing, no decay, no failure UI, modest affinity, memory as the primary reward. Design review against GAME_DESIGN.md pillars before each milestone.

## 12.2 Scope Creep into Pathfinding

**Risk**: “While we’re here, let NPCs walk around indoors.”  
**Mitigation**: Explicit exclusion in every milestone. Occupant is a fixed station placement. Revisit only after LR-5 and only with a new design doc.

## 12.3 narrative.ts Growth

**Risk**: New topics push the already large content file past maintainability.  
**Mitigation**: Prefer the Dialogue Modularization Blueprint first or extract invitation topics into `src/game/dialogue/invitations/` as part of LR-1.

## 12.4 Simulation Bugs

**Risk**: Occupant left outdoors and indoors, or stuck off-graph after departure.  
**Mitigation**: Single occupancy record is the source of truth; simulation skips exterior only while record exists; departure snaps to porch/schedule target; tests cover both paths.

## 12.5 Save Corruption

**Risk**: Partial v10 state or unknown IDs crash load.  
**Mitigation**: Defensive sanitizers (pattern already used for bakery/nook/greenhouse), migration tests from v9 fixtures, clear invalid occupancy/activity on load.

## 12.6 Content Bottleneck

**Risk**: Only Clara feels alive; other residents wait indefinitely.  
**Mitigation**: LR-3 adds a second host immediately after the pattern is proven. Registry is data-driven so later hosts are content, not architecture.

## 12.7 Conflict with Build 9

**Risk**: Copperwheel and Living Relationships both touch location enums, migrations, and dialogue.  
**Mitigation**: LR-1/LR-2 use only existing interiors. Arthur’s milestone (LR-4) is explicitly downstream of Build 9. Schema versions must be coordinated (if Build 9 lands first as v10, Living Relationships becomes v11—adjust numbers, not design).

## 12.8 Over-persistence

**Risk**: Storing too much runtime detail.  
**Mitigation**: Persist invitation, occupancy, teaching, and active activity only. Derive everything else.

## 12.9 Player Confusion

**Risk**: Players miss that an invitation exists.  
**Mitigation**: Offer is inside normal dialogue with the host (highest-traffic surface). Optional one-line noticeboard/mailbox reminder only after the core loop is proven. No quest log.

## 12.10 Residual Uncertainties

- Exact affinity numbers and offer cooldowns should be tuned in play; the design fixes only bounds and “no penalty.”  
- Whether owner occupancy should also occur outside invitations (passive “Clara is home”) is intentionally deferred; invitations are the required path for v1.  
- Guest NPCs and player-cottage hosting remain future work and are not required for the initiative’s success.
