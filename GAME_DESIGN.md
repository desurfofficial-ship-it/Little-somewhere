# GAME_DESIGN.md — LITTLE SOMEWHERE Game Design Document

**Tagline**: *A little world filled with thousands of little stories.*

---

## 1. Vision & Experience Goals

**LITTLE SOMEWHERE** is a relaxing, character-driven cozy life simulation set in a sun-drenched miniature neighborhood. Rather than grinding resource meters or rushing timers, gameplay centers on **observing daily routines, listening closely, noticing small clues in the environment, and gently mending relationships** between neighbors.

### Core Gameplay Loop
1. **Wake & Read**: Step onto the porch of *Willow Step Cottage* and check the *Willow Mailbox* for morning notes.
2. **Observe & Wander**: Stroll the cobblestone lanes across Morning, Afternoon, Golden Hour, and Lantern Dusk as residents move between cottages, workshops, the greenhouse, and the plaza.
3. **Talk & Branch**: Converse with residents via branching dialogue choices that raise trust (`0–5` hearts), reveal clues, unlock named **Memories**, and open alternate resolutions.
4. **Shape the World**: Watch the 3D neighborhood react physically—flowers bloom in window boxes, fountain water flows, creeping ivy clears, café tables open, lanterns glow, and reconciled neighbors gather together.
5. **Rest & Persist**: Return to your cottage porch to rest until tomorrow morning; all friendships, memories, and world transformations carry forward.

---

## 2. Visual Bible — Premium Handcrafted Storybook Diorama

*Official Source of Truth*: See `docs/art-direction/VISUAL_IDENTITY.md` and `docs/art-direction/VISUAL_QUALITY_STANDARDS.md` (preserving the warm personality of *Sunlit Diorama & Clay Storybook* elevated to premium cozy-game craft).

- **Camera**: Elevated isometric view (`28°` FOV) creating a tactile painted-wood-and-clay miniature feel.
- **Materials**: Matte polymer-clay walls and meadow grass (`roughness 0.82–0.92`) paired with glazed terracotta pots (`0.42–0.60`), glass greenhouse panes (`0.12`), and brushed brass hardware (`metalness 0.85, roughness 0.25`).
- **Four Atmospheric Phases**:
  - **Morning (`6:00 AM – 11:30 AM`)**: Crisp sky `#DCEBF2`, honeyed sunlight `#FFF1D0`.
  - **Afternoon (`11:30 AM – 4:00 PM`)**: Clear sunlit sky `#D9ECF5`, bright `#FFF6DF`.
  - **Golden Hour (`4:00 PM – 6:30 PM`)**: Apricot horizon `#F5CFA0`, amber key light `#FFB266`, cottage windows warming.
  - **Lantern Dusk (`6:30 PM – 9:00 PM`)**: Twilight periwinkle `#6F7FA8`, glowing cottage hearths & plaza festoon lanterns.
- **UI Palette & Type**: Cream linen cards (`#FAF5EC`), espresso ink (`#2D241E`), terracotta primary actions (`#C86446`), sage secondary growth (`#5E8062`), set in **Fraunces** + **Plus Jakarta Sans** + **JetBrains Mono**.

---

## 3. Neighborhood Map & Landmarks

- **Willow Step Cottage** *(SW)*: Player's home, porch rest trigger, and Willow Mailbox.
- **Hearth & Crumb Bakery** *(NW)*: Clara's warm sourdough shop; unlocks outdoor café tables.
- **Linden Book Nook** *(W)*: Nora's shaded bookshop holding the town almanac and festival ribbon.
- **Old Bell Gazebo** *(N-Center)*: Tall cedar spire landmark housing the silent brass bell.
- **Sunlit Fountain Plaza** *(Center)*: Cobblestone heart of town with a dry mossy stone fountain and Noticeboard.
- **Sora's Tea Cart** *(W-Plaza)*: Lavender-canopied cart brewing chamomile-pear tea.
- **Copperwheel Cottage** *(NE)*: Arthur's clockwork bench and oil-lamp porch.
- **Sunbeam Greenhouse** *(E)*: Glass-roofed flower house where Mina tends moon-petal seedlings.
- **Pinecone Woodshop** *(SE)*: Barnaby's cedar workshop.
- **Mirror Pond & Hollow Oak** *(S)*: Cerulean pond, wooden handrail footbridge, and the mossy oak root hiding a brass secret.
- **Fern Hollow Orchard** *(N, beyond the gazebo promenade)*: Six crabapple trees behind a stone-and-cedar gate lane, with a harvest ladder, crate corner, bee skep, and a quiet orchard bench — Milestone 3's first expansion district.

---

## 4. Cast of 9 Residents & Daily Schedules

| Resident | Role | Morning | Afternoon | Golden Hour | Dusk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Clara** | Sourdough Baker | Bakery Porch | Fountain Plaza | Gazebo Walk *(or Gazebo Steps w/ Arthur)* | Bakery Steps |
| **Arthur** | Clockmaker | Copperwheel Yard | East Bench | Gazebo Steps *(w/ Clara once reconciled)* | Copperwheel Porch |
| **Mina** | Botanist & Florist | Sunbeam Greenhouse | Bakery Patio | Fountain Plaza | Greenhouse Door |
| **Jun** | Letter Carrier | Willow Step Lane | Noticeboard Corner | South Cobblestones | Plaza South Edge |
| **Barnaby** | Retired Carpenter | Pinecone Woodshop | Old Bell Gazebo | East Bridge Path | Willow Step Lane |
| **Sora** | Violinist & Tea Brewer | Tea Cart | Fountain Plaza | Tea Cart | Plaza Lanterns |
| **Toby** | Sketchbook Artist | Mirror Pond Bank | Greenhouse Wall | Hollow Oak | Fountain Edge |
| **Nora** | Bookshop Keeper | Linden Book Nook | West Bench | Book Nook Porch | Linden Book Nook |
| **Pip** | Chalk-Note Messenger | Fountain Plaza | Mirror Pond Bridge | Gazebo Lawn | Bakery Stoop |

---

## 5. Interconnected Storyline — *The Silent Gazebo Bell*

Three autumns ago, after a storm cracked the gazebo beam, Clara and Arthur argued and drifted into a proud silence. Arthur unpinned the brass bell clapper and hid it inside blue linen by Mirror Pond; creeping ivy overtook the spire.

### Story Graph & Multiple Paths
1. **Spark the Mystery**: Talk to **Pip** in the plaza (or **Nora** at the Book Nook) -> sets `heardBellMystery`.
2. **Clear the Rafters**: Learn about the creeping ivy from **Mina** or inspect the Gazebo -> borrow **Barnaby's** cedar ladder -> sets `clearedGazeboIvy` (removes 3D ivy).
3. **Recover the Brass Clapper**: Either follow **Toby's** tip or inspect the **Hollow Oak** directly -> sets `foundBrassClapper` (removes oak glint).
4. **Soften the Silence (Multiple Narrative Approaches)**:
   - *Postcard Route*: Obtain the lost coastal postcard from **Nora**, hand it gently to **Jun**, and deliver it to **Arthur**.
   - *Chamomile Tea Route*: Ask **Sora** to brew chamomile-pear tea and share it with **Arthur**.
   - *Shared Baking Mediation*: Mediate directly with **Clara** (`shared_baking`) to invite Arthur over warm sourdough instead of apologies.
   - *Gentle Truth Mediation*: Tell **Clara** (`gentle_truth`) that Arthur kept the clapper wrapped safely in blue linen.
   - *Festival Restoration*: Bring clear rafters + recovered clapper to **Arthur** (`festival_ring`) to re-pin the bell and chime it together.

### Environmental Reactivity Matrix

| Story Flag(s) | Visible 3D Neighborhood Change |
| :--- | :--- |
| `plantedMoonPetals` / `repairedFountain` / `claraArthurReconciled` | Window-box planters bloom across cottages (0 -> 3 stages) |
| `repairedFountain` | Stone plaza fountain fills with water and animated droplet arcs |
| `clearedGazeboIvy` | Thick creeping ivy disappears from the Gazebo rafters |
| `foundBrassClapper` | Glinting brass object vanishes from the Hollow Oak root |
| `lanternsLit` or `bellRestored` | Overhead festoon string lanterns appear and glow across the plaza |
| `claraArthurReconciled` or `shared_baking` | Clara sets out sunlit outdoor bakery café tables with sourdough |
| `claraArthurReconciled` | Nora ties the marigold ribbon on the Gazebo; Clara & Arthur meet at Golden Hour |
| `bellRestored` | Inspecting the Gazebo Bell lets you pull the rope—bell swings with chimes & sparkles |
