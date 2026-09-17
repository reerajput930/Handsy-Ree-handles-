# Interactive 3D Portfolio

A portfolio homepage built around an interactive 3D character viewer — controllable by mouse **or by hand gestures** via your webcam.

## Overview

The page is a single-screen hero layout: an intro panel (name, tagline, bio, social handles) on the left, and a live 3D scene on the right showing a GLTF character model that you can rotate, zoom, and pan — either by dragging with the mouse or by holding up different hand gestures in front of your webcam.

The 3D character model is a digital likeness of the site's owner, not a generic avatar. **Ree** is their social handle, and the linked profiles below are attached to that same handle.

No build step, no framework — plain HTML/CSS/JS, with [Three.js](https://threejs.org/) for the 3D scene and [MediaPipe Hands](https://developers.google.com/mediapipe) for gesture recognition, both loaded from CDN.

## Features

### 3D viewer
- Loads and centers a `.glb` character model (`first.glb`), auto-fit and scaled to frame nicely.
- Mouse/touch drag to orbit (via Three.js `OrbitControls`); auto-rotates when idle.
- Decorative scene dressing: a subtle dotted ground grid, a faint elliptical orbit ring, and three floating glass-look props (ring light, laptop, drink) that gently bob up and down.
- A **reset view** button (circular-arrow icon) instantly restores the default camera position, zoom, and model rotation.

### Hand gesture control
Click the hand icon to enable your webcam. [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) tracks your hand in real time and maps poses to actions:

| Gesture | Action |
|---|---|
| ✋ Open hand (4 fingers) | Zoom in (dolly in, then narrows FOV for extra "optical" zoom) |
| ✊ Fist, thumb tucked | Zoom out |
| 👈 Fist, thumb out left | Rotate model left |
| 👉 Fist, thumb out right | Rotate model right |
| 👍 Fist, thumb up | Pan camera up (toward the face) |
| 👎 Fist, thumb down | Pan camera down (toward the feet) |
| ✌️ Two fingers | Show a 2D image over the 3D view |
| 🤟 Three fingers | Return to the 3D view |

- The small webcam preview overlays MediaPipe's own landmark skeleton (red joint dots, green connector lines) on top of the feed, drawn with `@mediapipe/drawing_utils`.
- Gesture classification is **3D-aware** (uses full x/y/z landmark distances, not just flat 2D position), so it stays accurate even when your hand is tilted or rotated relative to the camera instead of held flat.
- A small book icon near the theme switcher reveals a hover-card "gesture guide" listing all of the above.
- If no hand control has been used yet, a "TRY HAND CONTROL" hint shows under the model.

### Theming
Six built-in color themes (Warm, Noir, Seafoam, Desert, Savanna, Sage), switchable via small swatch pills in the top nav. The chosen theme persists across visits via `localStorage` and also drives the 3D scene's background/fog color.

### Layout
- Sticky top nav with a logo mark, gesture-guide hover card, and theme switcher.
- Responsive: stacks to a single column on narrower screens; the hero fills the full viewport height on desktop.

## Tech stack

- **Vanilla HTML / CSS / JS** — no build tooling, no framework.
- **[Three.js](https://threejs.org/)** (`r166`) — WebGL 3D scene, loaded via CDN + import map. Uses `GLTFLoader` for models and `OrbitControls` for camera interaction.
- **[MediaPipe Hands](https://developers.google.com/mediapipe)** + **`@mediapipe/drawing_utils`** — loaded on demand (only once you enable hand control), for real-time hand landmark detection and skeleton drawing.
- **Google Fonts** (Manrope) for typography.

## Project structure

```
portfolio/
├── index.html          # page structure — nav, hero panel, 3D viewer, gesture UI
├── styles.css           # all styling — theme tokens, layout, components
├── script.js             # Three.js scene setup, gesture logic, theme switching
├── 3d_model/
│   ├── first.glb                              # main character model
│   ├── ring_light.glb                         # decorative prop
│   ├── Meshy_AI_Coding_Workspace_on_L_....glb  # decorative prop (laptop)
│   ├── Meshy_AI_Orange_Prickly_Pear_S_....glb  # decorative prop (drink)
│   └── 2d.png                                  # image shown by the two-finger gesture
└── README.md
```

## Getting started

`script.js` is loaded as an ES module, so opening `index.html` directly (`file://…`) won't work — browsers block module imports over that protocol. Serve the folder over HTTP instead:

```bash
python -m http.server 8080
```

then open **http://localhost:8080**. (Any static server works — `npx serve .`, VS Code's Live Server extension, etc.)

Hand gesture control additionally requires:
- A webcam, with permission granted when prompted.
- An internet connection the first time you enable it (MediaPipe's model files load from CDN).

## Connect

- GitHub: [@reerajput930](https://github.com/reerajput930)
- LinkedIn: [riya-23400a200](https://www.linkedin.com/in/riya-23400a200/)
- Instagram: [@code_with_ree](https://www.instagram.com/code_with_ree/)
- YouTube: [@codewithree930](https://www.youtube.com/@codewithree930)
- Email: [rajputriya930@gmail.com](mailto:rajputriya930@gmail.com)

## Notes

- **Asset size**: the two Meshy-generated `.glb` props are ~93–94 MB each (~250 MB total for `3d_model/`). Fine for local use, but worth compressing (Draco mesh compression + texture downscaling) before deploying somewhere with bandwidth limits or slow clone/build times.
- **Tuning gestures**: thresholds and speeds (`THUMB_TUCK_THRESHOLD`, `ZOOM_SPEED`, `ROTATE_SPEED`, `PAN_SPEED`, etc.) are declared as named constants near the top of the gesture-control section in `script.js` if you want to adjust sensitivity.
- **Themes**: to add a new theme, add a `[data-theme="name"]` CSS variable block in `styles.css`, a matching entry in `SCENE_COLORS` in `script.js`, and a new theme-pill button in `index.html`.
