# The Maskmaker

A mobile-first browser puzzle prototype built on head-coupled perspective: the
phone screen behaves like a window into a small 3D room, and your head
position (from the front camera) decides where you are looking from.

> Status: **Milestone 3 — The Mask.** A mask at the back of the room wakes,
> makes eye contact, follows you with its eyes, blinks, and can deliberately
> look at points in the world. Puzzles come in later milestones.

## Setup

Requires Node 24 (pinned in `.nvmrc`).

```bash
nvm use           # switch to the pinned Node version
npm install       # install dependencies
npm run dev       # start dev server at http://localhost:5173
npm run build     # typecheck + production build into dist/
npm run preview   # serve the production build locally
```

`npm run dev` / `npm run build` first copy the MediaPipe WASM runtime from
`node_modules` into `public/mediapipe/wasm/` (gitignored). The face model lives
in `public/models/face_landmarker.task`. Everything is served from our own
origin; nothing is fetched from a CDN at runtime.

## Testing on desktop

Use the bottom bar to switch between **HEAD TRACKING** (your webcam) and
**MOUSE / TOUCH** (simulation). `localhost` counts as a secure context, so the
webcam works on desktop without HTTPS.

Mouse / touch mode — drag anywhere to move your virtual head. The position is
held when you release.

| Input | Effect |
| --- | --- |
| Drag left / right / up / down | Move viewpoint (simulated head) |
| Mouse wheel | Move viewpoint closer / farther from the screen |
| `R` | Mouse mode: recenter. Head mode: reset calibration |
| `D` (or the small **D** button, top-right) | Toggle debug panel |

For a phone-like composition, narrow the browser window to portrait or use
device emulation in DevTools.

## Testing on a phone (camera needs HTTPS)

Browsers only expose the camera on secure origins. `http://192.168.x.x:5173`
from your phone is **not** secure, and camera permission will fail. Use an
HTTPS tunnel to the dev server:

```bash
npm run dev           # terminal 1
npm run tunnel        # terminal 2 — runs `ngrok http 5173`
```

Open the `https://….ngrok-free.app` URL that ngrok prints on your phone (on
the free plan, tap **Visit Site** on ngrok's warning page once). Hot reload
works through the tunnel.

- ngrok needs a free account and `ngrok config add-authtoken <token>` once. If
  it reports that the agent is too old, run `ngrok update`.
- Alternative without an account: `brew install cloudflared`, then
  `cloudflared tunnel --url http://localhost:5173` and open the
  `https://….trycloudflare.com` URL.
- Or deploy a Vercel preview (below), which is always HTTPS.

On the phone: tap **HEAD TRACKING**, allow the camera, hold the phone
comfortably, look at the center of the screen, tap **CALIBRATE**, then keep
the phone still and move your head.

## Deploying to Vercel

`vercel.json` pins the install command (`npm ci`), build command
(`npm run build`, which runs the `prebuild` WASM copy step), and output
directory (`dist`).

```bash
npm i -g vercel       # once
vercel                # preview deployment (HTTPS URL, good for phone tests)
vercel --prod         # production deployment
```

Or import the Git repository in the Vercel dashboard and keep the defaults
(settings come from `vercel.json`). Node 24 is selected from `package.json`
`engines`.

## Privacy

- The camera is only requested after you tap **HEAD TRACKING**.
- The stream feeds a hidden `<video>` element that MediaPipe reads locally.
- Frames are never stored, recorded, uploaded, or displayed — except in the
  optional, off-by-default developer preview in the debug panel.
- Switching back to **MOUSE / TOUCH** stops the camera stream.

## Debug panel

Toggle with `D` or the **D** button.

- **Input mode** — head tracking or mouse/touch, switchable at any time.
- **Status** — `CAMERA: ACTIVE / BLOCKED / …`, `FACE: DETECTED / NOT DETECTED`,
  model delegate (GPU/CPU), tracking fps, inference time, video resolution.
- **Readout** — raw / filtered / smoothed pose, confidence, calibrated center,
  eye position, window size, frustum, render fps.
- **View sliders** — head sensitivity X/Y, depth sensitivity, smoothing,
  perspective strength, horizontal/vertical exaggeration, virtual eye
  distance, max displacement.
- **Tracking** — tracking rate (Hz), invert head X, show camera preview.
- **RESET / RECENTER CALIBRATION**, **RESET TUNING**.
- **Mask** (collapsible) — gaze mode (player / world), LOOK AT PLAYER /
  LEFT / CENTER / RIGHT, eye response, eye limits, mask follow strength /
  smoothing / max angle, eye contact tolerance, AUTO BLINK, BLINK NOW,
  CLOSE / OPEN EYES, REPLAY AWAKENING; readouts for awakening phase, gaze
  mode / target / point, eye contact, per-eye and mask rotation, lid
  closure. While the panel is open the world gaze targets are drawn as small
  wireframe markers.

## Architecture

```
MOUSE / TOUCH ─► PointerHeadSource ─┐
                                    ├─► headInput.pose (HeadPose) ─► HeadTrackedCamera
FRONT CAMERA ─► FaceTracker ────────┘        smoothing + mapping (tuning)
  (MediaPipe, ~30 Hz,                                 │
   One Euro filter,                                   ▼
   calibration, hold/return)                  OffAxisCamera ─► Three.js scene
```

- `src/tracking/HeadPose.ts` — the shared `{ x, y, z, confidence }` pose.
- `src/tracking/PointerHeadSource.ts` — mouse/touch simulation.
- `src/tracking/FaceTracker.ts` — camera + MediaPipe Face Landmarker,
  measurement, calibration, filtering, lost-tracking behavior.
- `src/tracking/headInput.ts` — picks the active source; the camera only reads
  `headInput.pose`.
- `src/rendering/OffAxisCamera.ts` — the screen is a fixed window in the plane
  `z = 0`; the camera sits at the eye and never rotates. Its frustum is
  recomputed so its edges always pass through the window edges.
- `src/rendering/HeadTrackedCamera.tsx` — maps the smoothed `HeadPose` to an
  eye position every render frame.
- `src/config/tuning.ts` — all live-tunable constants.
- `src/game/mask/` — the mask (Milestone 3):
  - `EyeController.ts` — reusable gaze logic, independent of any mesh.
    Modes `FOLLOW_PLAYER` (looks at the camera's actual eye position) and
    `LOOK_AT_WORLD_TARGET` (holds on a world point regardless of the
    player). Gaze is smoothed as a world-space direction with a critically
    damped spring, so it stays on target while the mask turns.
  - `Eyelids.ts` — synchronized lid closure: open / close and blinks, with
    seeded (reproducible) auto-blink timing.
  - `maskDirector.ts` — awakening timeline, debug commands, temporary world
    gaze targets, live stats.
  - `Mask.tsx` — procedural mask and 3D eyes (eyeball, iris, pupil, lids,
    catchlight); applies the director's state each frame. The mask turns at
    most a few degrees; the eyes do the work.
  - `maskShape.ts` / `maskTextures.ts` — shared relief function and painted
    silhouette, eye openings, aging, and gold inlays.

### The mask

- **Awakening** — eyes closed for ~1.5 s, open by ~2.1 s with a slightly
  downcast stare, find the player at ~2.4 s, and the mask itself begins to
  follow from ~3 s. In head-tracking mode the mask is asleep behind the
  calibration overlay and wakes when you enter the room.
- **Eye contact** — within `eyeContactTolerance` of the mask's forward axis
  the gaze locks exactly onto the player, a little faster, and the pupils
  dilate slightly. Outside it, the eyes still follow but trail fractionally.
- **World gaze** — when looking at a world target, head movement does not
  pull the eyes back; they stay on that point in the room.

### How head position is estimated

Per inference the tracker takes the center of each eye (midpoint of the eye
corners — not the iris, which moves with gaze) and uses the point between
them as the head position.

- **X / Y** — offset of that point from the image center, measured in
  inter-eye distances. This approximates physical displacement, independent
  of camera FOV, resolution, and distance. Camera frames are not mirrored, so
  X is negated (you move right → your face moves left in the image).
- **Z** — `calibratedIPD / currentIPD − 1`, using the 3D inter-eye distance
  (landmark z included, so turning your head barely affects it). 0 at
  calibration, positive when farther.
- **Calibration** — median of 24 consecutive face frames.
- **Filtering** — One Euro filter per axis (Z filtered more heavily), then
  the camera's frame-rate-independent exponential smoothing.
- **Lost face** — hold the last pose for 0.4 s, then ease back to neutral;
  when the face returns, blend back in over ~0.7 s.
