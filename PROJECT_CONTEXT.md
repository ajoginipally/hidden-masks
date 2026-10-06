# Hidden Masks --- Project Context

> **This document is the persistent source of truth for the project's
> concept, interaction model, technical architecture, design principles,
> and development roadmap.**
>
> AI coding agents should read this document before making substantial
> changes to the project.

------------------------------------------------------------------------

# 1. Project

## Hidden Masks

**Hidden Masks** is a mobile-first perspective puzzle game where the
player's physical viewpoint reveals things hidden inside miniature 3D
worlds.

The central interaction uses the device's **front-facing camera to
estimate the player's head/eye position**.

That position drives a **head-coupled, off-axis perspective
projection**, making the phone screen behave like a physical window into
a miniature world.

The player does not primarily rotate the environment with touch
controls.

Instead:

> **Move your physical head → see the world from a different
> perspective.**

The desired illusion is:

> **There is a tiny physical world behind the glass of my phone, and I
> can peek around inside it.**

This interaction is the foundation of Hidden Masks.

------------------------------------------------------------------------

# 2. Core Design Principle

The long-term design principle is:

# EVERY MASK TEACHES YOU A DIFFERENT WAY TO SEE.

Masks are not simply collectibles or cosmetic objects.

Each mask represents a different visual language or way of perceiving
the world.

Potential mechanics include:

-   perspective alignment
-   occlusion
-   negative space
-   shadows
-   reflections
-   symmetry
-   scale
-   expression
-   color
-   depth
-   impossible geometry

Future puzzles may combine multiple perceptual rules.

------------------------------------------------------------------------

# 3. Prototype Goal

The current project is a small proof-of-concept.

It should demonstrate:

1.  Head-tracked perspective.
2.  The phone behaving like a virtual window.
3.  A mysterious mask that appears aware of the player.
4.  Perspective-dependent object alignment.
5.  Occlusion-based discovery.
6.  The mask communicating clues through its gaze.

Target playtime:

**approximately 1--2 minutes.**

Do not expand the scope until these interactions feel excellent.

------------------------------------------------------------------------

# 4. Technology

Current stack:

-   React
-   TypeScript
-   Vite
-   Three.js
-   React Three Fiber where useful
-   MediaPipe Face Landmarker
-   CSS
-   Browser APIs

Primary targets:

-   iPhone Safari
-   Android Chrome

Desktop is supported primarily for development.

Deployment target:

-   Vercel
-   HTTPS

------------------------------------------------------------------------

# 5. Privacy

Front-camera processing should occur locally.

Camera footage must never be:

-   uploaded
-   transmitted
-   recorded
-   stored

The normal game experience should NOT display the selfie camera feed.

A developer-only preview may exist for debugging tracking.

------------------------------------------------------------------------

# 6. The Virtual Window

The most important technical idea in Hidden Masks is that the display
represents a stationary physical window.

Conceptually:

``` text
                 PLAYER

                    👁
                   /|\
                  / | \
                 /  |  \
                /   |   \
       ┌───────/────|────\───────┐
       │         PHONE           │
       │         SCREEN          │
       └─────────────────────────┘
                \   |   /
                 \  |  /
                  \ | /
                   \|/
              VIRTUAL WORLD
```

The player's eye moves.

The screen remains stationary.

The virtual world remains stationary.

Therefore the projection changes.

This should NOT be implemented as:

``` text
head moves right
      ↓
rotate camera left
```

Instead:

``` text
head position
      ↓
virtual eye position
      ↓
asymmetric projection frustum
      ↓
stationary world viewed through stationary window
```

This distinction is fundamental.

------------------------------------------------------------------------

# 7. Desired Perceptual Behavior

If the player moves their physical head RIGHT:

they should see the world from farther right.

Objects at different depths should exhibit natural parallax.

Previously occluded geometry may become visible.

Likewise:

``` text
HEAD LEFT
→ see around objects from left

HEAD RIGHT
→ see around objects from right

HEAD UP
→ see from higher viewpoint

HEAD DOWN
→ see from lower viewpoint

HEAD CLOSER
→ subtle depth response

HEAD FARTHER
→ subtle depth response
```

The experience should feel like:

> **I moved my head and saw around something.**

Not:

> **I moved my head and controlled a videogame camera.**

------------------------------------------------------------------------

# 8. HeadPose

Tracking should expose a normalized abstraction similar to:

``` ts
interface HeadPose {
  x: number;
  y: number;
  z: number;
  confidence: number;
}
```

Rendering systems should not care where the pose originated.

------------------------------------------------------------------------

# 9. Input Architecture

Hidden Masks supports two input modes.

## Head Tracking

``` text
Front Camera
     ↓
MediaPipe
     ↓
HeadPose
     ↓
OffAxisCamera
```

## Mouse / Touch Simulation

``` text
Mouse / Touch
     ↓
simulated HeadPose
     ↓
OffAxisCamera
```

Both MUST drive the same camera pipeline.

Do not create separate perspective implementations.

Mouse/touch mode is critical for development and must remain available.

------------------------------------------------------------------------

# 10. Calibration

Head tracking requires a neutral position.

Player flow:

``` text
POSITION YOURSELF

Hold your phone comfortably
and look at the center.

[ CALIBRATE ]
```

Calibration should sample several valid tracking frames rather than
relying on one frame.

Store approximately:

``` text
centerX
centerY
centerZ
```

Then:

``` text
currentPose - calibratedPose
```

becomes player displacement.

Neutral position should map approximately to:

``` text
x = 0
y = 0
z = 0
```

Calibration only needs to persist for the current session.

------------------------------------------------------------------------

# 11. Tracking Smoothing

Raw face tracking contains noise.

Smooth tracking before it reaches the virtual eye.

Goals:

-   minimal jitter
-   responsive intentional movement
-   stable world when player stops
-   no obvious delayed/swimming feeling

Prefer frame-rate-independent smoothing.

Z tracking may be noisier than X/Y.

If necessary:

**prioritize stable X/Y over accurate Z.**

------------------------------------------------------------------------

# 12. Lost Tracking

If tracking disappears briefly:

hold the last valid pose momentarily.

If tracking remains unavailable:

smoothly return toward calibrated neutral.

When tracking returns:

smoothly reacquire.

Never abruptly snap the viewpoint.

Debug status should distinguish:

``` text
CAMERA: ACTIVE
FACE: DETECTED
```

from:

``` text
CAMERA: ACTIVE
FACE: NOT FOUND
```

and:

``` text
CAMERA: BLOCKED
```

------------------------------------------------------------------------

# 13. Existing Debug System

The project has a useful developer panel.

Preserve it.

Existing or planned tuning values include:

-   Head sensitivity X
-   Head sensitivity Y
-   Depth sensitivity
-   Smoothing
-   Perspective strength
-   Horizontal exaggeration
-   Vertical exaggeration
-   Virtual eye distance
-   Max displacement
-   Key alignment tolerance
-   Show tracking dot
-   Recenter view
-   Reset tuning

Debug information includes values such as:

``` text
head X / Y / Z
smoothed X / Y / Z
confidence
calibrated center
eye world position
window width / height
frustum left / right
frustum bottom / top
key alignment
puzzle state
FPS
```

The debug system is part of the development workflow.

Do not remove it merely to simplify the UI.

`D` should toggle the panel where appropriate.

------------------------------------------------------------------------

# 14. Milestone 1 --- Virtual Window

## STATUS: IMPLEMENTED AND TESTED

Milestone 1 created the virtual-window system.

It includes:

-   3D room
-   geometry at multiple depths
-   off-axis projection
-   mouse/touch simulated viewpoint
-   debug panel
-   tuning controls

The user has tested this system and confirmed that the perspective
effect feels good.

Treat this as known-good infrastructure.

Do not rewrite it unless an actual problem is identified.

------------------------------------------------------------------------

# 15. Milestone 2 --- Head Tracking

## STATUS: IMPLEMENTED AND TESTED ON DESKTOP

Milestone 2 integrated MediaPipe/front-camera head tracking.

It includes or should include:

-   MediaPipe Face Landmarker
-   front-facing camera
-   X tracking
-   Y tracking
-   approximate Z
-   calibration
-   smoothing
-   sensitivity controls
-   tracking confidence
-   lost tracking behavior
-   mouse/touch fallback
-   debug information

The user has tested the behavior on their computer and confirmed it
works well.

The next important validation is testing the experience on an actual
phone.

Do not rewrite Milestone 1 or 2 while implementing later milestones.

------------------------------------------------------------------------

# 16. Mobile Testing

The recommended mobile test path is:

``` text
repository
    ↓
Vercel
    ↓
HTTPS preview
    ↓
phone browser
```

Primary browsers:

-   Safari on iPhone
-   Chrome on Android

Camera APIs generally require secure contexts.

Do not assume plain LAN HTTP will reliably provide camera access.

The production build should succeed with:

``` bash
npm run build
```

Avoid hardcoded localhost dependencies.

------------------------------------------------------------------------

# 17. The Mask

The mask is the central object/character of Hidden Masks.

It should feel:

-   ancient
-   elegant
-   mysterious
-   observant
-   intelligent
-   slightly uncanny
-   restrained

It should NOT feel:

-   overtly evil
-   like a horror monster
-   cartoonish
-   like a conventional NPC

The mask communicates primarily through:

-   its eyes
-   gaze direction
-   blinking
-   extremely subtle movement

The player should eventually understand:

> **The mask can see me.**

and later:

> **The mask can see things I cannot.**

------------------------------------------------------------------------

# 18. Cultural Direction

The prototype mask should be original and fictional.

Do not directly reproduce a specific culturally significant ceremonial
mask.

The larger game may eventually draw thoughtful inspiration from masks
and visual traditions from different regions.

Potential inspirations could include traditions involving:

-   theatrical masks
-   changing expression
-   shadow
-   reflection
-   transformation
-   symmetry
-   abstraction

Any real-world cultural inspiration should be researched and treated
intentionally rather than turning sacred or ceremonial objects into
generic fantasy power-ups.

------------------------------------------------------------------------

# 19. Milestone 3 --- The Mask

## STATUS: CURRENT DEVELOPMENT MILESTONE

Milestone 3 introduces the central mask.

It should:

-   exist physically inside the room
-   begin with closed eyes
-   awaken
-   establish eye contact
-   track the player's position
-   blink
-   subtly orient toward the player
-   deliberately look toward world-space targets

The emotional objective is:

# Make the player feel like the mask can see them.

------------------------------------------------------------------------

# 20. Mask Geometry

For the prototype, use an original fictional mask.

Simple/procedural Three.js geometry is acceptable.

Avoid introducing a complicated asset pipeline during this milestone.

Suggested appearance:

-   pale stone / ceramic / aged ivory
-   dark eye sockets
-   subtle imperfections
-   restrained gold/brass details
-   recognizable silhouette
-   slightly non-human proportions

The mask should sit toward the center/back of the chamber.

It is the visual focal point.

------------------------------------------------------------------------

# 21. Eyes

Create actual 3D eyes behind the eye openings.

Approximate hierarchy:

``` text
Mask
├── MaskGeometry
├── LeftEye
│   ├── Eyeball
│   ├── Iris
│   └── Pupil
└── RightEye
    ├── Eyeball
    ├── Iris
    └── Pupil
```

Prefer rotating eyeballs over sliding flat pupil textures.

Clamp eye rotation to believable ranges.

Subtle catchlights are encouraged.

The eyes carry most of the mask's personality.

------------------------------------------------------------------------

# 22. Awakening

Initial sequence:

``` text
0.0s
eyes closed

~1.0s
pause

~1.5s
eyes begin opening

~2.0s
eyes fully open
staring forward

~2.3s
eyes notice player

~2.5s
eyes move toward player

~3.0s+
mask subtly begins following
```

Timing is approximate.

Tune for emotional effect.

The intended player reaction is:

> **Wait... did that thing just look at me?**

Do not explain this moment with tutorial text.

------------------------------------------------------------------------

# 23. EyeController

Create a reusable gaze system.

At minimum:

``` ts
type GazeMode = "FOLLOW_PLAYER" | "LOOK_AT_WORLD_TARGET";
```

Conceptual API:

``` ts
setGazeMode("FOLLOW_PLAYER");

setWorldTarget(position);
```

Do not tightly couple gaze logic to the mask mesh.

Future puzzles will depend heavily on this system.

------------------------------------------------------------------------

# 24. FOLLOW_PLAYER

When following the player, use the existing virtual eye/player position.

Prefer calculating a real 3D gaze target.

Do not simply copy normalized X/Y directly into pupil translation unless
necessary.

Desired behavior:

``` text
PLAYER RIGHT
→ eyes RIGHT

PLAYER LEFT
→ eyes LEFT

PLAYER UP
→ eyes UP

PLAYER DOWN
→ eyes DOWN
```

The eyes should react quickly.

The physical mask should follow slowly.

------------------------------------------------------------------------

# 25. Mask Movement

The mask itself should move VERY little.

Starting target:

**approximately 2--5° maximum rotation.**

The player should almost question whether it moved.

Desired relationship:

``` text
EYES
████████████████
fast

MASK
████
slow + subtle
```

Too much movement makes the mask feel like an NPC.

Restraint is important.

------------------------------------------------------------------------

# 26. Eye Contact

When the player is approximately centered, the mask should appear to
look directly at them.

Implement configurable:

``` text
eyeContactTolerance
```

Within that region, gently bias gaze toward direct eye contact.

Do not snap.

Eye contact is one of the most important emotional effects in the
prototype.

------------------------------------------------------------------------

# 27. Blinking

Implement:

-   synchronized normal blinking
-   quick eyelid movement
-   slightly varied intervals
-   restrained frequency

Developer controls:

``` text
AUTO BLINK
ON / OFF

BLINK NOW

CLOSE EYES

OPEN EYES

REPLAY AWAKENING
```

Avoid behavior that is so random it becomes difficult to debug.

------------------------------------------------------------------------

# 28. World Gaze

The mask must be capable of deliberately looking somewhere other than
the player.

Create temporary world-space targets:

``` text
LEFT
CENTER
RIGHT
```

Developer controls:

``` text
LOOK AT PLAYER

LOOK LEFT

LOOK CENTER

LOOK RIGHT
```

The important distinction:

## FOLLOW_PLAYER

``` text
player moves
      ↓
mask continues following player
```

## LOOK_AT_WORLD_TARGET

``` text
player moves
      ↓
perspective changes
      ↓
mask continues looking at SAME PLACE
inside the virtual world
```

The player should be able to notice:

> **It's not looking at me anymore.**

This becomes part of the puzzle language.

------------------------------------------------------------------------

# 29. Mask Debug Controls

Extend the existing developer panel with a collapsible:

## MASK

section.

Include:

``` text
Gaze Mode
PLAYER / WORLD

LOOK AT PLAYER
LOOK LEFT
LOOK CENTER
LOOK RIGHT

Eye response speed
Eye horizontal limit
Eye vertical limit

Mask follow strength
Mask follow smoothing

Eye contact tolerance

AUTO BLINK
BLINK NOW

CLOSE EYES
OPEN EYES

REPLAY AWAKENING
```

Display:

``` text
current gaze mode
current gaze target

left eye rotation
right eye rotation

mask rotation
```

Do not remove existing tracking/camera controls.

------------------------------------------------------------------------

# 30. Milestone 3 Acceptance Criteria

Milestone 3 is complete when:

## Awareness

Player enters room.

Mask eyes are closed.

Mask awakens.

Mask establishes eye contact.

It feels like:

> **The mask noticed me.**

## Following

Move right.

World parallax responds.

Mask eyes follow.

Move left/up/down.

Eyes continue following.

## Weight

Move quickly.

Eyes respond first.

Mask follows slightly afterward.

## World Gaze

Activate:

``` text
LOOK LEFT
```

Mask stops following player.

Mask looks toward a world-space location.

Move viewpoint.

Mask remains focused on that location.

## Desktop

Mouse/touch simulation continues working.

## Mobile

Head tracking continues working.

Mask follows actual player movement.

------------------------------------------------------------------------

# 31. Milestone 4 --- Perspective Key

## STATUS: PLANNED --- DO NOT IMPLEMENT DURING MILESTONE 3

Three gold/brass objects exist at different depths.

From the neutral viewpoint:

``` text
     ◯

              ━━━

         ╱╲
```

They appear unrelated.

From the correct right-side perspective:

``` text
        ╭─◯━━━━
        │
        │
```

They visually form a key.

This is the first major perspective puzzle.

------------------------------------------------------------------------

# 32. Alignment Detection

Do NOT implement the key using:

``` ts
if (headX > threshold) {
  solveKey();
}
```

Instead, determine whether the actual projected geometry aligns.

Conceptually:

``` text
Fragment A
    ↓
project to screen
    ↓
screen position

Fragment B
    ↓
project to screen
    ↓
screen position

Fragment C
    ↓
project to screen
    ↓
screen position

        ↓

compare intended relationship

        ↓

alignmentScore
```

Expose:

``` text
alignmentScore = 0 → 1
```

Approximate response:

``` text
< 0.70
nothing

0.70–0.85
subtle shimmer

0.85–0.95
stronger response

> 0.95
hold alignment ~500ms

→ KEY FOUND
```

Thresholds should be configurable.

The alignment system should eventually be reusable for many perspective
puzzles.

------------------------------------------------------------------------

# 33. Key Discovery

Once alignment is maintained:

-   brief visual snap
-   fragments glow
-   fragments appear unified momentarily
-   satisfying feedback
-   display `KEY FOUND`
-   fragments disappear/fade
-   tiny key indicator appears

No complex inventory system is needed.

------------------------------------------------------------------------

# 34. Milestone 5 --- Hidden Door

## STATUS: PLANNED

After discovering the key:

the mask changes gaze mode.

Instead of following the player:

**it deliberately looks toward the opposite side of the room.**

No text says:

> LOOK LEFT.

The mask itself provides the clue.

The player follows its gaze.

------------------------------------------------------------------------

# 35. Occlusion Puzzle

A large architectural wall/pillar blocks a small hidden door.

From neutral:

``` text
        ██████
        ██████
        ██████
```

From the opposite viewpoint:

``` text
        ██████
       /██████
      / ██████

     🚪
```

The player physically moves their head and sees behind the obstruction.

This demonstrates a second use of the same perspective system:

## Key

Perspective causes objects to align.

## Door

Perspective reveals something hidden behind another object.

------------------------------------------------------------------------

# 36. Door Interaction

Behind the obstruction:

-   small door
-   keyhole
-   subtle gold highlight

If the key has been acquired and the player taps the door/keyhole:

``` text
KEY
 ↓
LOCK
 ↓
CLICK
 ↓
DOOR OPENS
```

Warm light appears behind it.

------------------------------------------------------------------------

# 37. Prototype Ending

Behind the door is the missing final fragment of the mask.

The fragment floats toward the central mask.

It attaches.

The mask becomes complete.

Pause.

The restored mask looks directly at the player.

The player can move left/right.

The mask follows.

The world continues exhibiting parallax.

Then fade toward black.

Display:

# IT SEES WHAT YOU SEE.

Then:

# HIDDEN MASKS

Then:

**RESTART**

------------------------------------------------------------------------

# 38. Complete Prototype Flow

``` text
OPEN HIDDEN MASKS
        ↓
ALLOW CAMERA
        ↓
CALIBRATE
        ↓
ENTER ROOM
        ↓
MASK EYES CLOSED
        ↓
MASK AWAKENS
        ↓
MASK NOTICES PLAYER
        ↓
MASK WATCHES PLAYER
        ↓
PLAYER EXPLORES BY MOVING HEAD
        ↓
LEAN RIGHT
        ↓
THREE FRAGMENTS ALIGN
        ↓
KEY
        ↓
KEY FOUND
        ↓
MASK STOPS WATCHING PLAYER
        ↓
MASK LOOKS LEFT
        ↓
PLAYER FOLLOWS GAZE
        ↓
LEAN LEFT
        ↓
SEE BEHIND WALL
        ↓
HIDDEN DOOR
        ↓
USE KEY
        ↓
DOOR OPENS
        ↓
MISSING MASK FRAGMENT
        ↓
FRAGMENT JOINS MASK
        ↓
MASK COMPLETED
        ↓
MASK LOOKS DIRECTLY AT PLAYER
        ↓
"IT SEES WHAT YOU SEE."
        ↓
HIDDEN MASKS
```

------------------------------------------------------------------------

# 39. Puzzle State

Eventually use a simple state machine.

Possible states:

``` ts
type GameState =
  | "INTRO"
  | "CAMERA_PERMISSION"
  | "CALIBRATION"
  | "MASK_AWAKENING"
  | "SEARCHING_FOR_KEY"
  | "KEY_ALIGNMENT"
  | "KEY_ACQUIRED"
  | "SEARCHING_FOR_DOOR"
  | "DOOR_REVEALED"
  | "DOOR_UNLOCKED"
  | "MASK_COMPLETED"
  | "ENDING";
```

Avoid unnecessary global state libraries for the prototype.

------------------------------------------------------------------------

# 40. Potential Future Masks

These are design ideas, NOT implementation requirements.

## Expression

The apparent emotional expression of a mask changes depending on viewing
angle.

This could draw thoughtful inspiration from theatrical traditions where
angle and lighting affect perceived expression.

## Reflection / Identity

Mirrors reveal different versions of the room.

The reflected world may contain geometry absent from the normal world.

## Shadow

Physical objects appear meaningless.

Their shadows form:

-   creatures
-   symbols
-   paths
-   instructions

## Negative Space

The empty space between objects forms meaningful geometry.

## Symmetry

Two unrelated halves become one object when viewed correctly.

## Scale

Perspective changes apparent size relationships and allows impossible
interactions.

## Alignment

Objects distributed throughout depth become symbols or tools from
precise viewpoints.

## Occlusion

Important information exists behind geometry and requires physically
peeking around it.

------------------------------------------------------------------------

# 41. Masks as Progression

The larger game could follow:

``` text
DISCOVER MASK
      ↓
UNDERSTAND ITS VISUAL LANGUAGE
      ↓
SOLVE ITS PUZZLES
      ↓
RESTORE MASK
      ↓
WEAR / ACTIVATE MASK
      ↓
GAIN NEW PERCEPTUAL RULE
      ↓
USE RULE IN FUTURE PUZZLES
```

Eventually puzzles could combine abilities/rules learned from multiple
masks.

This is long-term design direction only.

------------------------------------------------------------------------

# 42. The Mask as Silent Guide

Avoid conventional tutorial dialogue whenever possible.

Instead of:

``` text
"Look behind the pillar!"
```

the mask might simply:

``` text
👁  👁
 ↙  ↙
```

look toward it.

The player learns:

> Pay attention to what the mask sees.

Later masks may behave differently.

Possible future personalities expressed entirely through gaze:

-   calm mask --- slow deliberate guidance
-   mischievous mask --- looks away when caught staring
-   frightened mask --- eyes dart toward hidden threats
-   proud mask --- refuses eye contact
-   deceptive mask --- occasionally provides false gaze clues
-   broken mask --- one eye follows player while another watches
    something else

Do not implement these yet.

------------------------------------------------------------------------

# 43. Important Separation: Head Tracking vs Eye Tracking

The current system primarily tracks:

**where the player's head/face is relative to the display.**

This controls the virtual-window perspective.

Later experimentation may attempt to estimate:

**where the player's actual eyes are looking on the display.**

These are different problems.

Do NOT make accurate gaze estimation a dependency for the current
prototype.

For now:

``` text
HEAD POSITION
     ↓
world perspective
     +
mask follows player
```

Later:

``` text
IRIS / GAZE ESTIMATION
     ↓
what player is looking at
```

may become another mechanic.

------------------------------------------------------------------------

# 44. Performance

Target:

**60 FPS rendering where practical.**

Face inference does not need to run every rendering frame.

Possible architecture:

``` text
MediaPipe
20–30 FPS
     ↓
HeadPose
     ↓
smoothing/interpolation
     ↓
Three.js
requestAnimationFrame
```

Prioritize:

-   low tracking latency
-   smooth camera movement
-   battery efficiency
-   stable mobile performance

over unnecessary camera resolution.

------------------------------------------------------------------------

# 45. Mobile UX

Primary orientation:

**portrait**

Normal game UI should be extremely minimal.

Avoid:

-   virtual joysticks
-   excessive buttons
-   permanent instructions
-   clutter

The player's body is the primary camera controller.

If camera permission is unavailable:

offer:

**USE TOUCH MODE**

The prototype must remain usable.

------------------------------------------------------------------------

# 46. Development Philosophy

Build one mechanic at a time.

Order:

``` text
M1 Virtual Window
      ↓
M2 Head Tracking
      ↓
M3 Mask
      ↓
M4 Key
      ↓
M5 Door
      ↓
M6 Polish
```

Do not implement multiple future milestones just because they appear
straightforward.

Each milestone exists to validate a different part of the experience.

------------------------------------------------------------------------

# 47. Critical Rules for AI Coding Agents

## Rule 1 --- The screen is a window.

Do not turn head tracking into camera rotation.

## Rule 2 --- The viewer moves.

The room remains stationary.

## Rule 3 --- Preserve working systems.

Milestones 1 and 2 are known-good.

Do not rewrite them while adding unrelated features.

## Rule 4 --- Mouse simulation stays.

It is essential for development.

## Rule 5 --- Eyes carry the mask's personality.

Keep physical mask motion restrained.

## Rule 6 --- Gaze is gameplay.

The mask's gaze will eventually communicate puzzle information.

## Rule 7 --- Perspective puzzles should use geometry.

Prefer projected alignment/occlusion over arbitrary `headX` triggers.

## Rule 8 --- Mobile is the actual target.

Desktop is primarily a development environment.

## Rule 9 --- Privacy matters.

Camera data remains local.

## Rule 10 --- Stop at milestone boundaries.

Do not automatically implement future milestones.

## Rule 11 --- Rooms must obey the environmental design guidelines.

Before creating or substantially modifying room geometry, architecture,
puzzle environments, doors, passages, occluders, or environmental props:

**read `ROOM_DESIGN_GUIDELINES.md`.**

Environmental geometry must have believable physical relationships to
the room. Do not solve local visual or puzzle problems by adding
disconnected, unsupported, or unintentionally floating geometry.

Simple prototype art is acceptable.

Broken spatial logic is not.

------------------------------------------------------------------------

# 48. Current Project Status

Current status:

``` text
Milestone 1 — Virtual Window
✓ COMPLETE

Milestone 2 — Head Tracking
✓ COMPLETE
○ continued physical-phone validation remains important

Milestone 3 — Mask
✓ COMPLETE

Milestone 4 — Perspective Key
✓ COMPLETE / POC validated
○ perspective-puzzle authoring learnings documented for future use

Milestone 5 — Hidden Door
→ FUNCTIONALLY IMPLEMENTED / ENVIRONMENTAL READABILITY PASS IN PROGRESS
○ hidden-door occlusion, mask gaze clue, key interaction, door opening, and warm backlight implemented
○ doorway must read as physically integrated architecture rather than a floating/freestanding prop

Milestone 6 — Polish / Ending
○ PLANNED
```

------------------------------------------------------------------------

# 49. Current Instruction to Cursor

Before making substantial changes:

1.  Read this entire file.
2.  If the task creates or substantially modifies a room, architecture,
    environmental geometry, or puzzle-space composition, read
    `ROOM_DESIGN_GUIDELINES.md`.
3.  Inspect the existing repository.
4.  Identify the existing OffAxisCamera implementation.
5.  Identify the HeadPose/input abstraction.
6.  Identify MediaPipe tracking.
7.  Identify calibration/smoothing.
8.  Identify mouse/touch simulation.
9.  Identify the debug/tuning system.
10. Run the application.
11. Run the production build.

Compare the existing implementation against this document.

Do not assume filenames or architecture exactly match examples in this
document.

Preserve working code.

Milestones 1--4 are known-good infrastructure.

Milestone 5 gameplay is functionally implemented. Current work is
limited to the environmental/readability pass for the hidden doorway.

## Do not proceed to Milestone 6 until explicitly instructed.

# 50. Immediate Objective

The current objective is to make the Milestone 5 hidden doorway read as
a believable architectural opening that is physically integrated into
the chamber.

The doorway should not appear to float or read as a freestanding prop.

When opened, it should reveal convincing recessed depth and warm light
beyond the threshold while preserving the existing occlusion puzzle,
mask gaze clue, key interaction, and virtual-window behavior.

Environmental work must follow `ROOM_DESIGN_GUIDELINES.md`.

Do not increase puzzle difficulty or begin Milestone 6 during this pass.
