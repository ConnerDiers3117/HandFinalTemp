import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// =========================================
// Scene, Camera, Renderer
// =========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e1e1e);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.5, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);
controls.minDistance = 2;
controls.maxDistance = 15;

// =========================================
// Lighting
// =========================================
scene.add(new THREE.AmbientLight(0xffffff, 1.4));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 6, 5);
scene.add(dirLight);
const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight2.position.set(-5, 4, -3);
scene.add(dirLight2);
scene.add(new THREE.GridHelper(10, 10));
scene.add(new THREE.AxesHelper(2));

// =========================================
// Finger Configuration (fixes misalignment)
// Normalized closure: 0 = fully open, 1 = fully closed
// =========================================
const fingerConfig = {
  thumb:  { modelOpen: 0, modelClosed: 120, servoOpen: 180, servoClosed: 0, axis: 'x', sign: -1 },
  index:  { modelOpen: 0, modelClosed: 120, servoOpen: 180, servoClosed: 0, axis: 'y', sign: -1 },
  middle: { modelOpen: 0, modelClosed: 120, servoOpen: 180, servoClosed: 0, axis: 'y', sign: -1 },
  ring:   { modelOpen: 0, modelClosed: 120, servoOpen: 180, servoClosed: 0, axis: 'y', sign: -1 },
  pinky:  { modelOpen: 0, modelClosed: 120, servoOpen: 180, servoClosed: 0, axis: 'y', sign: -1 }
};

function mapRange(value, inMin, inMax, outMin, outMax) {
  return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
}

// State stores closure [0..1] for each finger
const state = {
  thumb: 0,
  index: 0,
  middle: 0,
  ring: 0,
  pinky: 0
};

const fingerNodeNames = {
  thumb: 'Contr_Fin_Tumb_03_01',
  index: 'Fin_Index_03_01',
  middle: 'Fin_Middle_03_03',
  ring: 'Fin_Ring_03_06',
  pinky: 'Fig_Pinky_03_06'
};
const fingerNodes = { thumb: null, index: null, middle: null, ring: null, pinky: null };
let handModel = null;
const sliderRefs = {};

// =========================================
// Model & Servo Sync
// =========================================
function applyFingerRotation(fingerName, closure) {
  const node = fingerNodes[fingerName];
  if (!node) return;
  const cfg = fingerConfig[fingerName];
  const modelDeg = mapRange(closure, 0, 1, cfg.modelOpen, cfg.modelClosed);
  node.rotation[cfg.axis] = cfg.sign * THREE.MathUtils.degToRad(modelDeg);
}

function updateModelFromState() {
  applyFingerRotation('thumb', state.thumb);
  applyFingerRotation('index', state.index);
  applyFingerRotation('middle', state.middle);
  applyFingerRotation('ring', state.ring);
  applyFingerRotation('pinky', state.pinky);
}

async function sendToServos() {
  const angles = {};
  for (const [finger, closure] of Object.entries(state)) {
    const cfg = fingerConfig[finger];
    const servoAngle = Math.round(mapRange(closure, 0, 1, cfg.servoOpen, cfg.servoClosed));
    angles[finger] = Math.min(180, Math.max(0, servoAngle));
  }
  const payload = {
    thumb: angles.thumb,
    index: angles.index,
    middle: angles.middle,
    ring: angles.ring,
    pinky: angles.pinky
  };
  try {
    await fetch('http://localhost:3000/hand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('Server not reachable (Arduino offline)');
  }
}

function setFingerValue(key, closure) {
  state[key] = Math.min(1, Math.max(0, closure));
  if (sliderRefs[key]) {
    sliderRefs[key].slider.value = closure;
    sliderRefs[key].valueEl.textContent = `${Math.round(closure * 100)}%`;
  }
  updateModelFromState();
  sendToServos();
}

function syncAllFromMaster(masterClosure) {
  for (const finger of Object.keys(state)) {
    setFingerValue(finger, masterClosure);
  }
}

// =========================================
// UI Construction
// =========================================
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

  slider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    setFingerValue(key, val);
  });

  row.appendChild(labelEl);
  row.appendChild(slider);
  row.appendChild(valueEl);

  sliderRefs[key] = { slider, valueEl };
  return row;
}

function buildUI() {
  const panel = document.createElement('div');
  panel.id = 'control-panel';

  const title = document.createElement('h2');
  title.textContent = 'Robot Hand Controller';
  panel.appendChild(title);

  // Master Flex Sensor slider
  const flexRow = document.createElement('div');
  flexRow.className = 'slider-row';
  const flexLabel = document.createElement('label');
  flexLabel.textContent = 'Flex Sensor:';
  const masterSlider = document.createElement('input');
  masterSlider.type = 'range';
  masterSlider.min = '0';
  masterSlider.max = '1';
  masterSlider.step = '0.01';
  masterSlider.value = '0';
  const flexValue = document.createElement('span');
  flexValue.className = 'value';
  flexValue.textContent = '0%';
  masterSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    flexValue.textContent = `${Math.round(val * 100)}%`;
    syncAllFromMaster(val);
  });
  flexRow.appendChild(flexLabel);
  flexRow.appendChild(masterSlider);
  flexRow.appendChild(flexValue);
  panel.appendChild(flexRow);
  panel.appendChild(document.createElement('hr'));

  // Individual finger sliders
  panel.appendChild(createSliderRow('Thumb', 'thumb'));
  panel.appendChild(createSliderRow('Index', 'index'));
  panel.appendChild(createSliderRow('Middle', 'middle'));
  panel.appendChild(createSliderRow('Ring', 'ring'));
  panel.appendChild(createSliderRow('Pinky', 'pinky'));

  // Buttons
  const buttonRow = document.createElement('div');
  buttonRow.className = 'button-row';
  const openBtn = document.createElement('button');
  openBtn.textContent = 'Open Hand';
  openBtn.onclick = () => syncAllFromMaster(0);
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close Hand';
  closeBtn.onclick = () => syncAllFromMaster(1);
  const pointBtn = document.createElement('button');
  pointBtn.textContent = 'Point';
  pointBtn.onclick = () => {
    setFingerValue('thumb', 0.3);
    setFingerValue('index', 0);
    setFingerValue('middle', 0.9);
    setFingerValue('ring', 0.9);
    setFingerValue('pinky', 0.9);
  };
  buttonRow.appendChild(openBtn);
  buttonRow.appendChild(closeBtn);
  buttonRow.appendChild(pointBtn);
  panel.appendChild(buttonRow);

  const notes = document.createElement('div');
  notes.id = 'notes';
  notes.innerHTML = `<strong>Mapping fixed:</strong><br>
    Model closed = 120°, Servo closed = 0°<br>
    Flex sensor / master slider controls all fingers simultaneously.`;
  panel.appendChild(notes);
  document.body.appendChild(panel);
}

buildUI();

// =========================================
// Load 3D Model
// =========================================
const loader = new GLTFLoader();
loader.load('/models/robot_hand/robot_hand.gltf', (gltf) => {
  handModel = gltf.scene;
  handModel.rotation.z = Math.PI;
  scene.add(handModel);

  // Auto-scale and center
  const box = new THREE.Box3().setFromObject(handModel);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 4 / maxDim;
  handModel.scale.setScalar(scale);
  const center = new THREE.Box3().setFromObject(handModel).getCenter(new THREE.Vector3());
  handModel.position.sub(center);
  handModel.position.y += new THREE.Box3().setFromObject(handModel).getSize(new THREE.Vector3()).y / 2;

  // Find and store finger nodes
  handModel.traverse((child) => {
    for (const [finger, name] of Object.entries(fingerNodeNames)) {
      if (child.name === name) fingerNodes[finger] = child;
    }
  });
  updateModelFromState();
  console.log('Model loaded & mapping applied');
}, undefined, (error) => console.error('Model load error:', error));

// =========================================
// Animation Loop
// =========================================
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});