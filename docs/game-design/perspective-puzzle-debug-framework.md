# Perspective-puzzle debug framework

Hidden Masks — Milestone 4 learnings. Hand this to agents brainstorming authoring/debug tools for perspective alignment puzzles.

## Goal

Author a multi-depth object that **reads as one silhouette from one design eye**, while looking scattered from other viewpoints. Scoring must use **projected geometry**, never HeadPose thresholds.

## Hard rule

**Alignment score ≠ readable silhouette.**

Score can be 1.0 / KEY FOUND while the mesh looks wrong. Verify scorer, authoring, and mesh as **three separate layers**.

---

## Architecture that works (current)

**Three fragments only:**

1. **Bow** — closed torus at bow depth
2. **Shaft** — one bar, shaftLeft → shaftRight at shaft depth
3. **Tooth** — one thick bar on a **single depth plane** (toothTop → tip); meets shaft tip in screen space when solved

**Do not** build a multi-segment “bit L” across depths (horizontal stub + vertical + notch). That caused:

- Z-visible slant
- Seam/step at shaft joints
- Skinny, hard-to-sculpt cosmetics
- Extra knobs that felt like rotation instead of translation

### Authoring recipe

1. Place anchors in **NDC at design eye** (bow, shaft L/R, tooth tip)
2. Unproject each to world at its **fragment depth**
3. Build meshes **from those points** (ring radius from same-depth rim, not 3D slant distance)
4. Tooth: both endpoints at **same Z**; toothTop uses `(toothNdcX, shaftRightNdcY)` so it attaches under the shaft tip on screen
5. Refresh ideals from **live aspect** so score=1 still holds across screen sizes
6. Expose NDC + depth as live sliders

### Design eye (this project)

- Eye ≈ `(0.85, 0.02, 5)`
- Pointer ≈ `x: 0.85/1.3 + deadZone`, `y: 0.02 + deadZone`
- Automation: `window.maskmaker.key` / `tuning`

### Code map

| Concern | Location |
|---|---|
| Silhouette NDC / depth → world layout | `src/game/key/keyLayout.ts` |
| Puzzle phases, scoring, fade | `src/game/key/keyPuzzle.ts` |
| Meshes (bow / shaft / tooth) | `src/game/key/KeyFragments.tsx` |
| Projection + alignment score | `src/game/alignment/` |
| Live sculpt sliders | `src/config/tuning.ts`, KEY section in `DebugPanel` |

---

## Layered framework (what to build next)

| Layer | Responsibility | Debug affordances |
|---|---|---|
| **Design eye** | Canonical solve viewpoint | One-click snap; show live eye vs target |
| **Ideal NDC** | Screen silhouette when solved | Live X/Y per anchor; overlay ideals (rings) vs projected (dots) |
| **Depths** | Parallax / hardness | Live Z per fragment; **warn if outside room AABB** |
| **Mesh build** | What the player sees | Rebuild from anchors only; same-depth bars; joint weld/overlap; screen-matched radii if multi-depth tubes meet |
| **Scorer** | Game logic | mean + **min-anchor gate**; stay-visible-on-found; freeze fade while sculpting |
| **Acceptance** | Done means | score≥0.9 at design eye **and** human/visual silhouette check (not score alone) |

---

## Failure modes we hit (ranked)

1. **Score-only verification** — KEY FOUND lied about visuals
2. **Mesh ≠ anchors** — shared quaternions, tipped torus, ring radius from 3D depth-distance → huge vertical C
3. **Room bounds** — deep + left NDC put bow through left wall → “missing ring”
4. **Multi-depth bit assembly** — looked like Z-slant, broken shaft, pixel seams; same world radius ≠ same screen thickness
5. **Wrong knobs** — Tooth NDC Y felt like rotate; notch height needed its own control; better to **delete the bit** than over-parameterize
6. **Agent screenshot loops** — token-expensive; live sliders + design-eye bookmark win

---

## Live sculpt controls (KEY → SILHOUETTE)

- Bow / Shaft L / Shaft R / Tooth **NDC X/Y**
- Depth bow / shaft / tooth
- Fragment offset X/Y/Z
- Disappear on found (off while debugging)
- Show alignment debug (yellow = projected, blue = ideal)

**Sculpt tips:** Tooth NDC X ≈ Shaft R NDC X → hangs straight; Tooth NDC Y → length. Prefer longer shaft + one thick tooth over a carved bit.

---

## Acceptance checklist

- [ ] At design eye: score ≥ 0.9 and min-anchor gate passes
- [ ] Projected dots sit on ideal rings
- [ ] Silhouette reads as **ring + shaft + tooth** (no Z-slant tooth, no broken shaft)
- [ ] Fragments stay inside room bounds at authoring depths
- [ ] Off design eye: pieces clearly separate (parallax still works)
- [ ] Stay-visible-on-found available while tuning

---

## Non-goals

- Don’t gate puzzles on HeadPose
- Don’t fade fragments while sculpting
- Don’t use screenshot ping-pong as the primary editor
- Don’t add decorative bit geometry until the 3-piece silhouette is solid

---

## Suggested brainstorm topics

1. Generalize into a **PerspectiveSilhouette** authoring tool (anchors, depths, mesh presets: ring/bar/box)
2. Auto room-bounds + screen-radius matching
3. “Snap to design eye” + silhouette screenshot regression
4. Presets: key, arrow, rune, face — same scorer, different mesh kits
5. Separate **scored anchors** from **cosmetic mesh** explicitly in the API
