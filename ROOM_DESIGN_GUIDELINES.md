# Hidden Masks — Room Design Guidelines

## Purpose

Hidden Masks rooms are miniature physical spaces viewed through the phone as though the screen were a window into another world.

Because the player can physically change viewpoint, environmental geometry must remain spatially believable from multiple perspectives.

A room should never feel like a collection of puzzle props floating inside a Three.js test scene.

POC geometry may be simple.

Spatial composition may not be arbitrary.

---

## Core Rule

**Every visible object must have a believable physical relationship to the environment.**

An object must:

- rest on a surface,
- attach to architecture,
- hang from a visible support,
- emerge from another structure,
- or intentionally float for an explicit supernatural/narrative reason.

Never accidentally float geometry.

---

## Room Design Hierarchy

Design rooms in this order:

1. ROOM SHELL
2. ARCHITECTURAL LANDMARK
3. MASK
4. PUZZLE STRUCTURE
5. CLUE LANGUAGE
6. REVEAL
7. REWARD / TRANSITION
8. ENVIRONMENTAL DRESSING

Do not begin by scattering puzzle props around an empty room.

---

## 1. Room Shell

Establish first:

- floor
- walls
- ceiling
- corners
- major openings
- major structural elements

The room must read as a coherent physical volume before puzzle geometry is added.

### Shell continuity

When adding an architectural feature, prefer modifying or extending the existing room shell over placing a separate architectural-looking object in front of it.

- A doorway should normally cut into or connect continuously with a wall.
- An alcove should recess into architecture.
- A column should visibly meet floor/ceiling or another structural element.

Avoid constructing “architecture props” that merely sit inside the room.

---

## 2. Architectural Landmark

Each room should eventually have at least one memorable architectural feature.

Examples:

- recessed shrine
- enormous column
- broken arch
- central pedestal
- deep alcove
- staircase
- suspended structure
- carved wall
- well
- doorway
- gallery of masks

This provides visual identity and can also support puzzle mechanics.

Avoid rooms that are simply rectangular boxes containing smaller boxes.

---

## 3. Mask Placement

The mask should feel intentionally placed within the architecture.

Possible relationships:

- mounted in a recess
- suspended from a visible structure
- resting above an altar
- embedded in a wall
- framed by architectural geometry

Its position should help establish visual hierarchy.

The mask is usually one of the most important visual elements in the room.

---

## 4. Puzzle Structure

Puzzle geometry should belong to the environment whenever possible.

Avoid obvious “developer geometry” whose only purpose is to make the mechanic function.

Prefer:

> architectural column that also creates occlusion

over:

> random box placed in front of the solution.

Prefer:

> ornamental brass pieces distributed through architecture

over:

> three obvious floating puzzle primitives.

POC versions may use simple geometry, but placement should anticipate eventual environmental integration.

---

## 5. Clue Language

Prefer environmental and character communication over explicit instructions.

Possible clue sources:

- mask gaze
- lighting
- composition
- repeated shapes
- material contrast
- motion
- sound
- architectural framing

Avoid tutorial text when the environment can communicate the idea.

---

## 6. Perspective Integrity

Hidden Masks uses a moving physical viewpoint.

Therefore all important geometry must be inspected from:

- neutral viewpoint
- left viewpoint
- right viewpoint
- slightly high viewpoint
- slightly low viewpoint

A composition that works from only one conventional game-camera angle is insufficient.

Head movement should reveal intentional information rather than:

- floating geometry
- disconnected walls
- paper-thin structures
- missing backsides
- accidental gaps
- obvious visual cheats

---

## 7. Architectural Openings

Doors, windows, tunnels, wells, passages, and recesses are architectural openings, not freestanding props.

A doorway should normally have:

- surrounding wall mass
- visible thickness
- jamb/reveal
- lintel/header
- threshold or floor relationship
- space behind the opening

When opened, the player should perceive depth beyond the doorway.

A door placed on the front of a rectangular box is not sufficient unless that box itself clearly reads as architecture.

Prefer cutting the opening into the room shell (split wall panels around the aperture, continuous jambs with the wall mass) rather than dropping a freestanding door-frame prop into the chamber.

---

## 8. Occlusion

Occlusion puzzles must use real geometry.

The occluding object should also make environmental sense.

**Good:**

- structural column
- wall return
- statue
- shelving
- arch
- machinery
- architectural slab

Avoid arbitrary blocks whose only apparent purpose is blocking the camera.

The hidden object must physically exist behind the occluder.

Never fake discovery by toggling visibility based on HeadPose.

---

## 9. Support and Contact

Before considering environmental geometry complete, inspect:

- Does it touch the floor?
- Does it connect to a wall?
- If hanging, what supports it?
- If embedded, is there surrounding material?
- If elevated, what holds it up?
- If floating, is floating intentional?

Visible unexplained gaps are failures unless narratively intentional.

---

## 10. Depth and Parallax

Use depth deliberately.

Foreground, middle-ground, and background elements should create useful parallax.

But depth should serve:

- spatial understanding
- atmosphere
- puzzle discovery
- visual hierarchy

Do not add depth merely to demonstrate that parallax exists.

---

## 11. Puzzle Difficulty

Do not make puzzles harder primarily by demanding extreme physical movement.

Physical movement should remain comfortable.

Prefer cognitive/perceptual difficulty:

- “What is the mask looking at?”
- “Why do those objects change relationship when I move?”
- “What is hidden behind that structure?”
- “What changes if I look from somewhere else?”

Difficulty should come from discovering the perceptual rule, not fighting the tracking system.

---

## 12. POC Standard

Prototype assets may use:

- boxes
- cylinders
- simple materials
- primitive lights
- placeholder textures

However, even POC geometry must preserve:

- believable support
- room continuity
- correct occlusion
- useful depth
- architectural relationships
- comfortable puzzle viewpoints

Simple art is acceptable.

Broken spatial logic is not.

---

## 13. Room Review Checklist

Before declaring a room/milestone complete:

### Spatial

- [ ] Floor, walls, and ceiling form a coherent volume.
- [ ] No unintended floating geometry.
- [ ] Architectural elements visibly connect to the room.
- [ ] New architecture extends or cuts the shell rather than sitting as a disconnected prop.
- [ ] Doors/openings have believable wall thickness and space behind them.
- [ ] Important geometry works from multiple head positions.

### Puzzle

- [ ] Puzzle mechanic uses real world geometry.
- [ ] Required head movement is comfortable.
- [ ] Discovery does not depend on arbitrary HeadPose thresholds.
- [ ] Puzzle objects feel related to the environment.
- [ ] Player can understand the reveal visually.

### Composition

- [ ] Room has clear visual hierarchy.
- [ ] Mask placement feels intentional.
- [ ] Puzzle area can be discovered without dominating the entire room.
- [ ] Foreground/midground/background are intentional.
- [ ] Lighting helps direct attention without functioning as an obvious objective marker.

### Transition

- [ ] Rewards/openings feel physically connected to the environment.
- [ ] Revealed spaces have visible depth.
- [ ] Player understands what changed.

---

## Agent Instruction

Before creating or substantially modifying a Hidden Masks room:

1. Read `PROJECT_CONTEXT.md`.
2. Read `ROOM_DESIGN_GUIDELINES.md`.
3. Identify the room shell and existing architectural structure.
4. Explain how new geometry physically connects to that structure.
5. Implement the smallest geometry necessary.
6. Inspect the result from multiple virtual viewpoints.
7. Check the Room Review Checklist.

Do not solve local visual problems by adding disconnected geometry.

If a requested object appears to float or lacks architectural support, fix its environmental relationship rather than decorating the object to hide the problem.
