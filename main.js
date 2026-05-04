import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ============================================================================
// THREE.JS SCENE SETUP
// ============================================================================
// Initialize the 3D scene with camera, renderer, and basic controls
// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e1e1e);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.5, 8);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);

// ============================================================================
// LIGHTING SETUP
// ============================================================================
// Add ambient and directional lights to illuminate the 3D scene and grid helper
// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 1.4));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 6, 5);
scene.add(dirLight);
const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight2.position.set(-5, 4, -3);
scene.add(dirLight2);
scene.add(new THREE.GridHelper(10, 10));

// ============================================================================
// FINGER CONFIGURATION
// ============================================================================
// Configuration object defining rotation ranges and servo mappings for each finger
// Each finger maps model rotation degrees to servo angles (0-180 degrees)
// Finger configuration
const fingerConfig = {
  thumb:  { modelOpen: 0, modelClosed: 120, servoOpen: 180, servoClosed: 0, axis: 'x', sign: -1 },
  index:  { modelOpen: 0, modelClosed: 120, servoOpen: 180, servoClosed: 0, axis: 'y', sign: -1 },
  middle: { modelOpen: 0, modelClosed: 120, servoOpen: 180, servoClosed: 0, axis: 'y', sign: -1 },
  ring:   { modelOpen: 0, modelClosed: 120, servoOpen: 180, servoClosed: 0, axis: 'y', sign: -1 },
  pinky:  { modelOpen: 0, modelClosed: 120, servoOpen: 180, servoClosed: 0, axis: 'y', sign: -1 }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Maps a value from one numeric range to another (linear interpolation)
// Used to convert between closure values (0-1), model degrees, and servo angles (0-180)
function mapRange(value, inMin, inMax, outMin, outMax) {
  return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
}

// ============================================================================
// STATE MANAGEMENT & REFERENCES
// ============================================================================

// Current closure state for each finger (0 = open, 1 = fully closed)
const state = { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 };

// Maps finger names to their corresponding 3D model node names in the GLTF scene
const fingerNodeNames = {
  thumb: 'Contr_Fin_Tumb_03_01',
  index: 'Fin_Index_03_01',
  middle: 'Fin_Middle_03_03',
  ring: 'Fin_Ring_03_06',
  pinky: 'Fig_Pinky_03_06'
};

// Stores references to the loaded 3D finger node objects from the model
const fingerNodes = { thumb: null, index: null, middle: null, ring: null, pinky: null };

// The loaded 3D hand model (GLTF scene object)
let handModel = null;

// Stores references to UI slider elements for direct DOM manipulation
const sliderRefs = {};

// ============================================================================
// 3D MODEL MANIPULATION FUNCTIONS
// ============================================================================

// Applies rotation to a finger node based on closure value (0-1)
// Interpolates between modelOpen and modelClosed degrees, then converts to radians
function applyFingerRotation(fingerName, closure) {
  const node = fingerNodes[fingerName];
  if (!node) return;
  const cfg = fingerConfig[fingerName];
  const modelDeg = mapRange(closure, 0, 1, cfg.modelOpen, cfg.modelClosed);
  node.rotation[cfg.axis] = cfg.sign * THREE.MathUtils.degToRad(modelDeg);
}

// Updates all finger rotations in the 3D model based on current state values
function updateModelFromState() {
  applyFingerRotation('thumb', state.thumb);
  applyFingerRotation('index', state.index);
  applyFingerRotation('middle', state.middle);
  applyFingerRotation('ring', state.ring);
  applyFingerRotation('pinky', state.pinky);
}

// ============================================================================
// SERVO & STATE CONTROL FUNCTIONS
// ============================================================================

// Sends current finger angles to the backend server via HTTP POST request
// Converts closure values (0-1) to servo angles (0-180 degrees)
async function sendToServos() {
  const angles = {};
  for (const [finger, closure] of Object.entries(state)) {
    const cfg = fingerConfig[finger];
    const servoAngle = Math.round(mapRange(closure, 0, 1, cfg.servoOpen, cfg.servoClosed));
    angles[finger] = Math.min(180, Math.max(0, servoAngle));
  }
  try {
    await fetch('http://localhost:3000/hand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(angles)
    });
  } catch (err) {
    console.warn('Server not reachable');
  }
}

// Updates a single finger's closure value and syncs changes to both UI and servos
function setFingerValue(key, closure) {
  state[key] = Math.min(1, Math.max(0, closure));
  if (sliderRefs[key]) {
    sliderRefs[key].slider.value = closure;
    sliderRefs[key].valueEl.textContent = `${Math.round(closure * 100)}%`;
  }
  updateModelFromState();
  sendToServos();
}

// Synchronizes all fingers to the same closure value
function syncAllFromMaster(masterClosure) {
  for (const finger of Object.keys(state)) {
    setFingerValue(finger, masterClosure);
  }
}

// ============================================================================
// THROTTLE UTILITY
// ============================================================================

// Throttle function to limit how often syncAllFromMaster is called
function throttle(func, limit) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      func(...args);
    }
  };
}

// Create throttled version (max once per 100ms) to prevent flooding the servo with updates
const throttledSync = throttle(syncAllFromMaster, 100);

// ============================================================================
// UI BUILDER FUNCTIONS
// ============================================================================

// Build UI (same as before)
// Creates a slider UI row with label, range input, and value display
function createSliderRow(label, key) {
  const row = document.createElement('div');
  row.className = 'slider-row';
  const labelEl = document.createElement('label');
  labelEl.textContent = `${label}:`;
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.01';
  slider.value = '0';
  const valueEl = document.createElement('span');
  valueEl.className = 'value';
  valueEl.textContent = '0%';
  slider.addEventListener('input', (e) => setFingerValue(key, parseFloat(e.target.value)));
  row.appendChild(labelEl);
  row.appendChild(slider);
  row.appendChild(valueEl);
  sliderRefs[key] = { slider, valueEl };
  return row;
}

// Builds the complete control panel UI with flex sensor slider, individual finger sliders, and preset buttons
function buildUI() {
  const panel = document.createElement('div');
  panel.id = 'control-panel';
  panel.innerHTML = '<h2>Robot Hand Controller</h2>';
  const flexRow = document.createElement('div');
  flexRow.className = 'slider-row';
  flexRow.innerHTML = '<label>Flex Sensor:</label><input type="range" min="0" max="1" step="0.01" value="0"><span class="value">0%</span>';
  const masterSlider = flexRow.querySelector('input');
  const flexValue = flexRow.querySelector('.value');
  masterSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    flexValue.textContent = `${Math.round(val * 100)}%`;
    syncAllFromMaster(val);
  });
  panel.appendChild(flexRow);
  panel.appendChild(document.createElement('hr'));
  panel.appendChild(createSliderRow('Thumb', 'thumb'));
  panel.appendChild(createSliderRow('Index', 'index'));
  panel.appendChild(createSliderRow('Middle', 'middle'));
  panel.appendChild(createSliderRow('Ring', 'ring'));
  panel.appendChild(createSliderRow('Pinky', 'pinky'));
  const btnDiv = document.createElement('div');
  btnDiv.className = 'button-row';
  btnDiv.innerHTML = `
    <button id="openBtn">Open Hand</button>
    <button id="closeBtn">Close Hand</button>
    <button id="pointBtn">Point</button>
  `;
  panel.appendChild(btnDiv);
  document.body.appendChild(panel);
  document.getElementById('openBtn').onclick = () => syncAllFromMaster(0);
  document.getElementById('closeBtn').onclick = () => syncAllFromMaster(1);
  document.getElementById('pointBtn').onclick = () => {
    setFingerValue('thumb', 0.3);
    setFingerValue('index', 0);
    setFingerValue('middle', 0.9);
    setFingerValue('ring', 0.9);
    setFingerValue('pinky', 0.9);
  };
}
buildUI();

// ============================================================================
// 3D MODEL LOADING
// ============================================================================
// Load 3D model
const loader = new GLTFLoader();
loader.load('/models/robot_hand/scene.gltf', (gltf) => {
  handModel = gltf.scene;
  handModel.rotation.z = Math.PI;
  scene.add(handModel);
  const box = new THREE.Box3().setFromObject(handModel);
  const size = box.getSize(new THREE.Vector3());
  const scale = 4 / Math.max(size.x, size.y, size.z);
  handModel.scale.setScalar(scale);
  const center = new THREE.Box3().setFromObject(handModel).getCenter(new THREE.Vector3());
  handModel.position.sub(center);
  handModel.position.y += new THREE.Box3().setFromObject(handModel).getSize(new THREE.Vector3()).y / 2;
  handModel.traverse((child) => {
    for (const [finger, name] of Object.entries(fingerNodeNames)) {
      if (child.name === name) fingerNodes[finger] = child;
    }
  });
  updateModelFromState();
  console.log('Model loaded');
});

// ============================================================================
// FLEX SENSOR POLLING
// ============================================================================
// Flex sensor polling (every 200ms, throttled updates)
// Tracks last flex value to avoid updating UI on negligible changes
let lastFlex = 0;

// Polls the backend for flex sensor data and updates hand model accordingly
// Only updates when change is greater than 1% to avoid excessive updates
async function pollFlex() {
  try {
    const res = await fetch('http://localhost:3000/flex');
    const data = await res.json();
    if (data.flex !== undefined && Math.abs(data.flex - lastFlex) > 0.01) {
      lastFlex = data.flex;
      // Update UI sliders
      const masterSlider = document.querySelector('#control-panel input[type="range"]');
      const flexSpan = document.querySelector('#control-panel .slider-row:first-child .value');
      if (masterSlider) masterSlider.value = data.flex;
      if (flexSpan) flexSpan.textContent = `${Math.round(data.flex * 100)}%`;
      // Use throttled version to prevent flooding
      throttledSync(data.flex);
    }
  } catch (err) {
    // silent fail
  }
  setTimeout(pollFlex, 200);
}
setTimeout(pollFlex, 1000);

// ============================================================================
// MAIN ANIMATION LOOP
// ============================================================================
// Animation loop
// Continuously renders the 3D scene and updates orbit controls
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// Handles window resize events to maintain aspect ratio and renderer size
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
