import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/* ── Theme → scene background ──────────────────────────── */

const SCENE_COLORS = {
  warm:    '#ecddd4',
  noir:    '#0a0a0c',
  seafoam: '#c8e4e2',
  desert:  '#ecdad8',
  savanna: '#d8ccac',
  sage:    '#c8d4bf',
};

/* ── Three.js setup ────────────────────────────────────── */

const viewer = document.getElementById('viewer');

const scene = new THREE.Scene();
scene.background = new THREE.Color(SCENE_COLORS.warm);
scene.fog = new THREE.Fog(SCENE_COLORS.warm, 8, 22);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000);
camera.position.set(0, 0, 5.8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0xecddd4, 1);
viewer.appendChild(renderer.domElement);

(function initSize() {
  const w = viewer.clientWidth  || 900;
  const h = viewer.clientHeight || 560;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
})();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping   = true;
controls.enablePan       = false;
controls.enableZoom      = false;
controls.autoRotate      = true;
controls.autoRotateSpeed = 1.2;
controls.minPolarAngle   = Math.PI / 2.6;
controls.maxPolarAngle   = Math.PI / 1.7;

/* Lighting */
scene.add(new THREE.AmbientLight(0xffffff, 2.0));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
dirLight.position.set(4, 6, 4);
scene.add(dirLight);
const rimLight = new THREE.DirectionalLight(0xd0e4ff, 1.2);
rimLight.position.set(-4, 2, -3);
scene.add(rimLight);

/* ── Decorative scene dressing — subtle grid, orbit ring, floating spheres ── */

{
  const gridSize = 14, divisions = 16;
  const dotPositions = [];
  for (let i = 0; i <= divisions; i++) {
    for (let j = 0; j <= divisions; j++) {
      dotPositions.push((i / divisions - 0.5) * gridSize, -1.7, (j / divisions - 0.5) * gridSize);
    }
  }
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(dotPositions, 3));
  const dotMat = new THREE.PointsMaterial({ color: 0x9a9a9a, size: 0.035, transparent: true, opacity: 0.28 });
  scene.add(new THREE.Points(dotGeo, dotMat));
}

const orbitRing = new THREE.Mesh(
  new THREE.RingGeometry(2.55, 2.58, 80),
  new THREE.MeshBasicMaterial({ color: 0x8fae9f, transparent: true, opacity: 0.32, side: THREE.DoubleSide })
);
orbitRing.rotation.x = Math.PI / 2.15;
scene.add(orbitRing);

/* each floating prop starts as a glass placeholder sphere, then swaps in the
   real model (scaled to fit) once its .glb has finished loading */
const PROP_CONFIGS = [
  { pos: [1.9, 0.7, -0.3],  radius: 0.13, phase: 0,   url: './3d_model/Meshy_AI_Coding_Workspace_on_L_0913003750_texture.glb', targetSize: 0.55 },
  { pos: [-1.7, -0.4, 0.5], radius: 0.16, phase: 2.1, url: './3d_model/ring_light.glb', targetSize: 0.6 },
  { pos: [1.3, -0.9, 0.9],  radius: 0.1,  phase: 4.2, url: './3d_model/Meshy_AI_Orange_Prickly_Pear_S_0913004519_texture.glb', targetSize: 0.35 },
];

const floatingSpheres = PROP_CONFIGS.map(({ pos, radius, phase }) => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 24),
    new THREE.MeshPhysicalMaterial({
      color: 0xbfe0d8, transparent: true, opacity: 0.55,
      roughness: 0.15, transmission: 0.4, thickness: 0.4,
    }),
  );
  mesh.position.set(...pos);
  scene.add(mesh);
  return { mesh, baseY: pos[1], phase };
});

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

const propLoader = new GLTFLoader();
propLoader.setDRACOLoader(dracoLoader);
PROP_CONFIGS.forEach((config, i) => {
  propLoader.load(
    config.url,
    (gltf) => {
      const obj = gltf.scene;

      /* scale first, then measure + re-centre — some exported models (this
         ring light included) have their geometry offset far from their own
         local origin, so centering before scaling leaves that offset only
         partially cancelled out and the model ends up nowhere near [pos]. */
      const rawSize = new THREE.Vector3();
      new THREE.Box3().setFromObject(obj).getSize(rawSize);
      const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z || 1);
      obj.scale.setScalar(config.targetSize / maxDim);

      const center = new THREE.Vector3();
      new THREE.Box3().setFromObject(obj).getCenter(center);
      obj.position.sub(center);

      const wrapper = new THREE.Group();
      wrapper.add(obj);
      wrapper.position.set(...config.pos);
      scene.add(wrapper);

      const entry = floatingSpheres[i];
      scene.remove(entry.mesh);
      entry.mesh.geometry.dispose();
      entry.mesh.material.dispose();
      entry.mesh = wrapper;
    },
    undefined,
    (err) => console.warn(`[portfolio] prop failed to load: ${config.url}`, err.message),
  );
});

/* ── Load first.glb ────────────────────────────────────── */

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
let currentModel = null;

function disposeModel(model) {
  model.traverse((child) => {
    child.geometry?.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => m.dispose());
    }
  });
}

function spawnPlaceholder() {
  if (currentModel) { scene.remove(currentModel); disposeModel(currentModel); }
  const geo = new THREE.SphereGeometry(1.1, 40, 40);
  const mat = new THREE.MeshStandardMaterial({ color: 0x7a9db8, metalness: 0.35, roughness: 0.35 });
  currentModel = new THREE.Mesh(geo, mat);
  scene.add(currentModel);
}

async function loadFirstModel() {
  spawnPlaceholder();

  try {
    const next = await Promise.race([
      new Promise((resolve, reject) => {
        loader.load('./3d_model/first.glb', (gltf) => resolve(gltf.scene), undefined, reject);
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
    ]);

    if (currentModel) { scene.remove(currentModel); disposeModel(currentModel); }
    currentModel = next;
    scene.add(currentModel);

    /* Centre + fit — scale first, then measure + re-centre (see note on the
       prop loader above: centering before scaling only cancels the offset
       correctly when the model's native center is already near its origin) */
    const rawSize = new THREE.Vector3();
    new THREE.Box3().setFromObject(currentModel).getSize(rawSize);
    const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z || 1);
    currentModel.scale.setScalar(3 / maxDim);

    const center = new THREE.Vector3();
    new THREE.Box3().setFromObject(currentModel).getCenter(center);
    currentModel.position.sub(center);

    currentModel.rotation.y = DEFAULT_ROT_Y;

  } catch (e) {
    console.warn('[portfolio] first.glb failed to load:', e.message);
  }
}

loadFirstModel();

/* ── Gesture control (MediaPipe Hands) ─────────────────── */

const DEFAULT_ROT_Y  = 1.5;

const CAM_DIST_MIN    = 1.1;    // closest the camera can physically get before it'd clip into the model
const CAM_DIST_MAX    = 11;
const FOV_DEFAULT     = camera.fov;
const FOV_MIN         = 12;     // narrowing the lens past CAM_DIST_MIN gives extra "optical" zoom with no clipping
const ZOOM_SPEED      = 0.05;   // distance per detected frame — "slowly"
const FOV_ZOOM_SPEED  = 0.35;   // degrees per detected frame
const ROTATE_SPEED    = 0.025;  // rad per detected frame
const PAN_SPEED       = 0.02;   // world units per detected frame
const PAN_Y_MIN       = -1.3;   // keeps the framing from sliding past the model's feet
const PAN_Y_MAX       = 1.3;    // keeps the framing from sliding past the model's head

const THUMB_TUCK_THRESHOLD = 0.15; /* below this, thumb reads as tucked into the fist, not sticking out */

let gestureEnabled  = false;
let mpHands         = null;
let noHandTimer     = null;

/* ── classify which gesture the hand is making ──
   open hand (4 fingers)   → zoom in
   3 fingers up            → show the 3D model
   2 fingers up            → show the 2D image
   fist, thumb tucked in   → zoom out
   fist, thumb out left    → rotate left
   fist, thumb out right   → rotate right
   fist, thumb out up      → camera up
   fist, thumb out down    → camera down             */
/* 3D distance so the checks below don't break when the hand is tilted or rotated
   toward the camera instead of held flat — a 2D-only (x, y) test gets fooled by
   foreshortening at an angle in exactly that situation. */
function dist3D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function classifyHand(lm) {
  const wrist = lm[0];

  /* a finger is "up" when its tip sits farther from the wrist than its own pip
     joint does — true regardless of the hand's rotation, unlike comparing raw
     y-coordinates (which only works when the hand faces the camera flat). */
  const isExtended = (pipIdx, tipIdx) => dist3D(wrist, lm[tipIdx]) > dist3D(wrist, lm[pipIdx]);

  const up = [
    isExtended(6, 8),    // index
    isExtended(10, 12),  // middle
    isExtended(14, 16),  // ring
    isExtended(18, 20),  // pinky
  ].filter(Boolean).length;

  const thumbTip = lm[4];
  const thumbMcp = lm[2];
  const indexMcp = lm[5];
  const thumbExtension = dist3D(thumbTip, indexMcp);

  /* a thumb sticking out this far only happens on a fist — an open/2-finger/3-finger
     hand never has it. Checking this first (and tolerating one noisy "up" finger)
     stops a fist held at an angle from flickering into twoFinger/threeFinger when
     tracking briefly misreads a curled finger as extended. */
  if (thumbExtension >= THUMB_TUCK_THRESHOLD && up <= 1) {
    const dx = thumbTip.x - thumbMcp.x;
    const dy = thumbTip.y - thumbMcp.y;
    if (Math.abs(dy) > Math.abs(dx)) return dy < 0 ? 'thumbUp' : 'thumbDown';
    return dx < 0 ? 'thumbLeft' : 'thumbRight';
  }

  if (up === 4) return 'open';
  if (up === 3) return 'threeFinger';
  if (up === 2) return 'twoFinger';
  if (up === 1) return 'none';
  return 'fist';
}

const GESTURE_LABELS = {
  open:        '✋  ZOOM IN',
  threeFinger: '🤟  3D MODEL',
  twoFinger:   '✌️  2D IMAGE',
  fist:        '✊  ZOOM OUT',
  thumbLeft:   '👈  ROTATE LEFT',
  thumbRight:  '👉  ROTATE RIGHT',
  thumbUp:     '👍  CAMERA UP',
  thumbDown:   '👎  CAMERA DOWN',
};

const image2D = document.getElementById('viewerImage2D');

/* ── hand-landmark skeleton overlay ──────────────────────── */

const gestureCanvas = document.getElementById('gestureCanvas');
const canvasCtx     = gestureCanvas.getContext('2d');

function drawHandSkeleton(landmarks) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, gestureCanvas.width, gestureCanvas.height);
  if (landmarks && window.drawConnectors && window.drawLandmarks) {
    window.drawConnectors(canvasCtx, landmarks, window.HAND_CONNECTIONS, { color: '#22c55e', lineWidth: 2 });
    window.drawLandmarks(canvasCtx, landmarks, { color: '#ef4444', lineWidth: 1, radius: 3 });
  }
  canvasCtx.restore();
}

/* slide the camera and its look-at target up/down together (same distance, same facing —
   just a vertical pedestal move) so zooming in close still lets you pan from face to feet */
function panCameraVertical(deltaY) {
  const newY = THREE.MathUtils.clamp(controls.target.y + deltaY, PAN_Y_MIN, PAN_Y_MAX);
  const applied = newY - controls.target.y;
  controls.target.y  += applied;
  camera.position.y  += applied;
}

/* two-stage zoom: dolly the camera in first, then once it's as close as it can safely
   get without clipping into the model, keep going by narrowing the FOV (optical zoom) */
function zoomIn() {
  const offset = camera.position.clone().sub(controls.target);
  const dist   = offset.length();

  if (dist > CAM_DIST_MIN) {
    offset.setLength(Math.max(CAM_DIST_MIN, dist - ZOOM_SPEED));
    camera.position.copy(controls.target).add(offset);
  } else if (camera.fov > FOV_MIN) {
    camera.fov = Math.max(FOV_MIN, camera.fov - FOV_ZOOM_SPEED);
    camera.updateProjectionMatrix();
  }
}

function zoomOut() {
  if (camera.fov < FOV_DEFAULT) {
    camera.fov = Math.min(FOV_DEFAULT, camera.fov + FOV_ZOOM_SPEED);
    camera.updateProjectionMatrix();
  } else {
    const offset = camera.position.clone().sub(controls.target);
    const dist   = offset.length();
    offset.setLength(Math.min(CAM_DIST_MAX, dist + ZOOM_SPEED));
    camera.position.copy(controls.target).add(offset);
  }
}

/* ── called every frame MediaPipe detects results ── */
function onHandResults(results) {
  const label = document.getElementById('gestureLabel');
  const lmArr = results.multiHandLandmarks;

  if (!lmArr || lmArr.length === 0) {
    drawHandSkeleton(null);
    /* no hand — wait 2 s then restore auto-rotate (longer gap = fewer false flickers) */
    if (!noHandTimer) {
      noHandTimer = setTimeout(() => {
        controls.autoRotate = true;
        if (label) label.textContent = 'TRY HAND CONTROL';
        noHandTimer = null;
      }, 2000);
    }
    return;
  }

  clearTimeout(noHandTimer);
  noHandTimer = null;
  controls.autoRotate = false;

  const lm      = lmArr[0];
  drawHandSkeleton(lm);
  const gesture = classifyHand(lm);

  if (label) label.textContent = GESTURE_LABELS[gesture] ?? '';

  /* the 2D image is only ever shown while the two-finger gesture is actively held —
     every other gesture keeps it hidden, so a stray misread can't leave it stuck on */
  image2D.classList.toggle('is-active', gesture === 'twoFinger');

  switch (gesture) {
    case 'open':
      zoomIn();
      break;
    case 'fist':
      zoomOut();
      break;
    case 'thumbLeft':
      if (currentModel) currentModel.rotation.y -= ROTATE_SPEED;
      break;
    case 'thumbRight':
      if (currentModel) currentModel.rotation.y += ROTATE_SPEED;
      break;
    case 'thumbUp':
      panCameraVertical(PAN_SPEED);
      break;
    case 'thumbDown':
      panCameraVertical(-PAN_SPEED);
      break;
  }
}

/* ── toggle gesture mode on/off ── */
async function toggleGesture() {
  const btn   = document.getElementById('gestureToggle');
  const video = document.getElementById('gestureVideo');
  const label = document.getElementById('gestureLabel');

  /* — turn OFF — */
  if (gestureEnabled) {
    gestureEnabled = false;
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }
    video.classList.remove('is-active');
    gestureCanvas.classList.remove('is-active');
    drawHandSkeleton(null);
    btn.classList.remove('is-active');
    controls.autoRotate = true;
    label.textContent = 'TRY HAND CONTROL';
    return;
  }

  /* — turn ON — */
  btn.style.pointerEvents = 'none'; /* prevent double-click during load */

  try {
    /* step 1: load MediaPipe (only first time) */
    if (!mpHands) {
      label.textContent = 'loading AI…';

      const loadScript = src => new Promise((ok, fail) => {
        const s = document.createElement('script');
        s.src = src;
        s.crossOrigin = 'anonymous';
        s.onload = ok;
        s.onerror = fail;
        document.head.appendChild(s);
      });

      /* try jsDelivr, fall back to unpkg */
      const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915';
      try {
        await loadScript(`${base}/hands.js`);
      } catch {
        await loadScript('https://unpkg.com/@mediapipe/hands@0.4.1646424915/hands.js');
      }

      /* drawing_utils renders the red-dot/green-line landmark skeleton onto gestureCanvas */
      const drawingBase = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1620248257';
      try {
        await loadScript(`${drawingBase}/drawing_utils.js`);
      } catch {
        await loadScript('https://unpkg.com/@mediapipe/drawing_utils@0.3.1620248257/drawing_utils.js');
      }

      mpHands = new window.Hands({
        locateFile: f => `${base}/${f}`
      });
      mpHands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      });
      mpHands.onResults(onHandResults);
    }

    /* step 2: ask for camera permission */
    label.textContent = 'allow camera…';
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 320, height: 240 }
    });
    video.srcObject = stream;
    await video.play();

    /* step 3: start detection loop */
    gestureEnabled = true;
    gestureCanvas.width  = video.videoWidth  || 320;
    gestureCanvas.height = video.videoHeight || 240;
    video.classList.add('is-active');
    gestureCanvas.classList.add('is-active');
    btn.classList.add('is-active');
    label.textContent = '';

    async function gestureLoop() {
      if (!gestureEnabled) return;
      try { await mpHands.send({ image: video }); } catch { /* skip frame */ }
      requestAnimationFrame(gestureLoop);
    }
    gestureLoop();

  } catch (err) {
    /* show what went wrong for 3 seconds */
    const msg = err.name === 'NotAllowedError' ? 'camera denied'
              : err.name === 'NotFoundError'    ? 'no camera found'
              : 'failed — check console';
    label.textContent = msg;
    console.error('[gesture]', err);
    setTimeout(() => { label.textContent = 'TRY HAND CONTROL'; }, 3000);
  } finally {
    btn.style.pointerEvents = '';
  }
}

document.getElementById('gestureToggle').addEventListener('click', toggleGesture);

/* ── Reset view ─────────────────────────────────────────── */

document.getElementById('resetView').addEventListener('click', () => {
  if (currentModel) {
    currentModel.rotation.x = 0;
    currentModel.rotation.y = DEFAULT_ROT_Y;
  }
  camera.fov = FOV_DEFAULT;
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  camera.position.set(0, 0, 5.8);
  controls.autoRotate = true;
});

/* ── Theme switching ───────────────────────────────────── */

function applyTheme(name) {
  const root = document.documentElement;
  root.style.transition = 'opacity 0.16s ease';
  root.style.opacity    = '0';
  setTimeout(() => {
    root.setAttribute('data-theme', name);
    const col = new THREE.Color(SCENE_COLORS[name] ?? SCENE_COLORS.warm);
    scene.background = col;
    if (scene.fog) scene.fog.color = col;
    renderer.setClearColor(col, 1);
    document.querySelectorAll('.theme-pill').forEach((pill) => {
      pill.classList.toggle('is-active', pill.dataset.theme === name);
    });
    localStorage.setItem('portfolio-theme', name);
    root.style.opacity = '1';
  }, 160);
}

document.querySelectorAll('.theme-pill').forEach((pill) => {
  pill.addEventListener('click', () => applyTheme(pill.dataset.theme));
});

const savedTheme = localStorage.getItem('portfolio-theme');
if (savedTheme && SCENE_COLORS[savedTheme]) applyTheme(savedTheme);

/* ── Resize ────────────────────────────────────────────── */

window.addEventListener('resize', () => {
  const w = viewer.clientWidth;
  const h = viewer.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

/* ── Render loop ───────────────────────────────────────── */

(function animate() {
  requestAnimationFrame(animate);
  controls.update();

  const t = performance.now() * 0.001;
  floatingSpheres.forEach(({ mesh, baseY, phase }) => {
    mesh.position.y = baseY + Math.sin(t + phase) * 0.08;
  });

  renderer.render(scene, camera);
})();
