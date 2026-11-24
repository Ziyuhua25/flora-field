# FLORA / FIELD 2.0

[Open the studio](https://ziyuhua25.github.io/flora-field/)

FLORA / FIELD is an interactive particle-art collection with nineteen procedural
sculptures and separate modes for sculpting, flowing, swirling, morphing and
drawing. You can begin with a mouse or touch, then enable hand tracking if you
want to work in mid-air.

## Controls

| Input | Effect |
| --- | --- |
| Open palm / fist | Disperse / gather |
| Point / pinch | Stir nearby particles or draw / grab and move the field |
| Two hands | Change separation to scale, or turn both hands to rotate |
| Quick open-hand swipe | Send a local shockwave |
| Morph mode | Show 0–5 fingers to select an alternate form |
| Mouse or touch | Tap to disperse, drag to rotate, Shift-drag to move, scroll or pinch to zoom |
| Keyboard | Arrow keys cycle specimens, Space disperses, C toggles Cinematic mode, F opens fullscreen, R resets the view, Esc exits a panel or Cinematic mode |

Studio provides a standalone background. Camera mode composites your mirrored
camera view and supports an optional spatial frame. The webcam estimates
positions from a single view. Webcam frames stay on the device.
Hand tracking loads MediaPipe Hands 0.4.1675469240 from jsDelivr when requested.
Camera permission requires HTTPS or localhost. Mouse and touch remain available
if camera access or model loading fails.

The settings drawer offers coordinated color themes, motion controls, camera
sensitivity, adaptive quality, performance metrics and export. The PNG export
includes the current artwork and, in Camera mode, its video background. Short
recordings include the artwork and drawing only. Recording depends on browser
support. Ambient audio is off at launch.

## Implementation

- `renderer.js` simulates each particle with position and velocity using WebGL 2
  transform feedback and renders point sprites. The Canvas 2D fallback uses a
  lower point budget and follows the same interaction modes.
- `specimens.js` produces seeded geometry and color layers for the gallery and
  Morph targets.
- `hands.js` smooths landmarks, debounces discrete poses and limits inference
  to one video frame at a time.
- `studio.js` controls media, interaction, exports, quality tiers and the UI.

No build is needed. Run `python3 -m http.server 8000` in this directory, then
open `http://localhost:8000`. GitHub Pages publishes the root of `main`.
The [pre-upgrade release](https://github.com/Ziyuhua25/flora-field/tree/18d4f3fd822d379f31d67c1c23ed235b637b06f8)
remains in the repository history.

## Verification

Run `node geometry-test.mjs` for geometry and gesture checks. The browser workflow
runs Chromium and WebKit against the Pages subpath, checks eight viewport sizes,
tests camera denial and mock frames, and posts a same-environment 4,800-particle
comparison in the workflow summary. CI timing captures its software-rendered
environment. A physical device and real webcam are required to validate hardware
performance and gesture accuracy.
