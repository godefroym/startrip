import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import {
  LOCAL_BUBBLE_RADIUS_LY,
  NAMED_STARS,
  createSyntheticPopulation,
  sphericalToCartesian,
} from "./data/nearby-stars.js";

const sceneRoot = document.querySelector("#sceneRoot");
const densityRange = document.querySelector("#densityRange");
const densityValue = document.querySelector("#densityValue");
const sizeRange = document.querySelector("#sizeRange");
const sizeValue = document.querySelector("#sizeValue");
const boundaryToggle = document.querySelector("#boundaryToggle");
const shellToggle = document.querySelector("#shellToggle");
const labelsToggle = document.querySelector("#labelsToggle");
const resetShipButton = document.querySelector("#resetShip");
const sunViewButton = document.querySelector("#sunView");
const hudStarCount = document.querySelector("#hudStarCount");
const hudSource = document.querySelector("#hudSource");
const hudSpeed = document.querySelector("#hudSpeed");
const hudPosition = document.querySelector("#hudPosition");
const hudDistance = document.querySelector("#hudDistance");
const statusText = document.querySelector("#statusText");
const selectedName = document.querySelector("#selectedName");
const selectedMeta = document.querySelector("#selectedMeta");

const initialWidth = Math.max(sceneRoot.clientWidth, 1);
const initialHeight = Math.max(sceneRoot.clientHeight, 1);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(initialWidth, initialHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
sceneRoot.append(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x03050e, 0.0028);

const camera = new THREE.PerspectiveCamera(
  60,
  initialWidth / initialHeight,
  0.1,
  2200,
);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 3.2;

const keys = new Set();
const pointer = new THREE.Vector2();
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

const groups = {
  boundary: new THREE.Group(),
  deepSky: new THREE.Group(),
  synthetic: new THREE.Group(),
  named: new THREE.Group(),
  labels: new THREE.Group(),
};

scene.add(groups.deepSky, groups.boundary, groups.synthetic, groups.named, groups.labels);
scene.add(createBackgroundHalo());

const ambientLight = new THREE.HemisphereLight(0x8fb7ff, 0x08101d, 0.65);
const keyLight = new THREE.DirectionalLight(0xffdfb0, 1.1);
keyLight.position.set(12, 16, 9);
scene.add(ambientLight, keyLight);

const state = {
  velocity: new THREE.Vector3(),
  ship: null,
  engineFlare: null,
  shipLight: null,
  syntheticStars: [],
  namedStars: [],
  syntheticPoints: null,
  namedPoints: null,
  selectedStar: null,
  deepSkyPoints: null,
  gaiaCatalog: [],
  gaiaMeta: null,
  labelStars: [],
};

const starMaterial = createStarMaterial();

createShip();
buildBoundary();
renderer.domElement.addEventListener("pointermove", handlePointerMove);
window.addEventListener("resize", onResize);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", (event) => keys.delete(event.code));

densityRange.addEventListener("input", () => {
  refreshDensityLabel();
  rebuildSimulation();
});

sizeRange.addEventListener("input", () => {
  refreshSizeLabel();
  applySizeScale();
});

boundaryToggle.addEventListener("change", () => {
  groups.boundary.visible = boundaryToggle.checked;
});

shellToggle.addEventListener("change", () => {
  groups.deepSky.visible = shellToggle.checked;
});

labelsToggle.addEventListener("change", () => {
  groups.labels.visible = labelsToggle.checked;
  groups.named.visible = true;
});

resetShipButton.addEventListener("click", () => {
  resetShip();
  setStatus("Vaisseau recentre dans le bubble local.");
});

sunViewButton.addEventListener("click", () => {
  moveShipToSunView();
  setStatus("Vue rapprochee autour du Soleil.");
});

init();

async function init() {
  refreshDensityLabel();
  refreshSizeLabel();
  await loadGaiaCatalog();
  rebuildSimulation();
  resetShip(true);
  applySizeScale();
  animate();
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.033);
  const elapsed = clock.getElapsedTime();

  starMaterial.uniforms.uTime.value = elapsed;
  updateShip(delta);
  updateCamera(delta);
  updateDeepSky(elapsed);
  updateSelection();
  updateHud();

  renderer.render(scene, camera);
}

function rebuildSimulation() {
  prepareNamedStars();
  rebuildSyntheticStars();
  rebuildNamedPresentation();
  rebuildDeepSky();
  const totalStars = state.gaiaCatalog.length > 0
    ? state.syntheticStars.length + 1
    : state.syntheticStars.length + state.namedStars.length;
  hudStarCount.textContent = totalStars.toLocaleString("fr-FR");
}

function prepareNamedStars() {
  state.namedStars = NAMED_STARS.map(enrichStar);
}

function rebuildSyntheticStars() {
  clearGroup(groups.synthetic);

  const density = Number.parseInt(densityRange.value, 10);
  const sourceCatalog = state.gaiaCatalog.length > 0
    ? state.gaiaCatalog
        .map(applyKnownNameToGaiaStar)
        .map(enrichStar)
    : createSyntheticPopulation(
        density,
        LOCAL_BUBBLE_RADIUS_LY,
        19,
      )
        .map(enrichStar)
        .filter((star) => star.distanceLy > 2.5);

  state.syntheticStars = sourceCatalog;
  state.syntheticPoints = createPointCloud(sourceCatalog, {
    sizeMultiplier: 0.6,
    alphaScale: 0.76,
  });

  groups.synthetic.add(state.syntheticPoints);
}

function rebuildNamedPresentation() {
  clearGroup(groups.named);
  clearGroup(groups.labels);
  state.labelStars = [];

  groups.named.add(createSunAnchor());

  if (state.gaiaCatalog.length === 0) {
    state.namedPoints = createPointCloud(state.namedStars, {
      sizeMultiplier: 1.4,
      alphaScale: 1,
    });
    state.namedPoints.userData.starPool = state.namedStars;
    groups.named.add(state.namedPoints);
    state.labelStars = state.namedStars.filter((star) => star.name !== "Soleil");
  } else {
    state.namedPoints = null;
    const labeledGaiaStars = state.syntheticStars.filter((star) => star.displayName);
    const labeledNames = new Set(labeledGaiaStars.map((star) => star.displayName));
    const unmatchedNamedStars = state.namedStars.filter(
      (star) => star.name !== "Soleil" && !labeledNames.has(star.name),
    );
    state.labelStars = [...labeledGaiaStars, ...unmatchedNamedStars];
  }

  state.labelStars.forEach((star) => {
    const label = createLabelSprite(star.displayName ?? star.name);
    label.position.copy(star.position).add(new THREE.Vector3(0, 1.4, 0));
    label.scale.set(8, 2.1, 1);
    groups.labels.add(label);
  });

  groups.labels.visible = labelsToggle.checked;
  setSelectedStar(state.namedStars[0]);
}

function rebuildDeepSky() {
  clearGroup(groups.deepSky);

  const random = mulberry32(37);
  const positions = [];
  const colors = [];
  const sizes = [];
  const brightnesses = [];
  const twinkles = [];
  const shellRadius = 360;
  const count = Math.round(Number.parseInt(densityRange.value, 10) * 1.1);

  for (let index = 0; index < count; index += 1) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(random() * 2 - 1);
    const radius = shellRadius + (random() - 0.5) * 24;
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const temperature = 2500 + random() * 10000;
    const color = temperatureToColor(temperature);

    positions.push(x, y, z);
    colors.push(color.r, color.g, color.b);
    sizes.push(1.2 + random() * 4.6);
    brightnesses.push(0.28 + random() * 0.52);
    twinkles.push(random());
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("aBrightness", new THREE.Float32BufferAttribute(brightnesses, 1));
  geometry.setAttribute("aTwinkle", new THREE.Float32BufferAttribute(twinkles, 1));

  state.deepSkyPoints = new THREE.Points(geometry, starMaterial);
  groups.deepSky.add(state.deepSkyPoints);

  createNebulaSprites(mulberry32(73)).forEach((sprite) => groups.deepSky.add(sprite));
  groups.deepSky.visible = shellToggle.checked;
}

function createPointCloud(stars, options) {
  const positions = [];
  const colors = [];
  const sizes = [];
  const brightnesses = [];
  const twinkles = [];

  stars.forEach((star) => {
    positions.push(star.position.x, star.position.y, star.position.z);
    colors.push(star.color.r, star.color.g, star.color.b);
    sizes.push(star.renderSize * options.sizeMultiplier);
    brightnesses.push(
      THREE.MathUtils.clamp(star.visualBrightness * options.alphaScale, 0.08, 1),
    );
    twinkles.push(star.twinkle);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("aBrightness", new THREE.Float32BufferAttribute(brightnesses, 1));
  geometry.setAttribute("aTwinkle", new THREE.Float32BufferAttribute(twinkles, 1));

  const cloud = new THREE.Points(geometry, starMaterial);
  cloud.userData.alphaScale = options.alphaScale;
  return cloud;
}

function enrichStar(star) {
  const positionSource = Number.isFinite(star.x) && Number.isFinite(star.y) && Number.isFinite(star.z)
    ? { x: star.x, y: star.y, z: star.z }
    : star.distanceLy === 0
      ? { x: 0, y: 0, z: 0 }
      : sphericalToCartesian(star.distanceLy, star.raDeg, star.decDeg);
  const color = star.colorRgb
    ? rgbToThreeColor(star.colorRgb)
    : temperatureToColor(star.temperatureK);
  const luminositySolarResolved = Number.isFinite(star.luminositySolar)
    ? Math.max(star.luminositySolar, 0.000001)
    : estimateLuminosityFromRadiusAndTemperature(star.radiusSolar, star.temperatureK);
  const apparentMagnitude = Number.isFinite(star.apparentMagnitudeG)
    ? star.apparentMagnitudeG
    : Number.isFinite(star.photGMeanMag)
      ? star.photGMeanMag
      : estimateApparentMagnitude(star.distanceLy, luminositySolarResolved);
  const visualBrightness = Number.isFinite(star.visualBrightness)
    ? star.visualBrightness
    : apparentMagnitudeToVisualBrightness(apparentMagnitude);
  const renderSize = THREE.MathUtils.clamp(
    Math.pow(star.radiusSolar, 0.42) * (star.synthetic ? 2.2 : 4.6),
    star.synthetic ? 1.3 : 3,
    star.synthetic ? 4.2 : 17,
  );

  return {
    ...star,
    position: new THREE.Vector3(positionSource.x, positionSource.y, positionSource.z),
    color,
    luminositySolarResolved,
    apparentMagnitude,
    visualBrightness,
    renderSize,
    twinkle: Math.random(),
  };
}

function createShip() {
  const ship = new THREE.Group();

  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0xf0f6ff,
    metalness: 0.8,
    roughness: 0.26,
    emissive: 0x0b1120,
    emissiveIntensity: 0.45,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x92ebff,
    emissive: 0x69d7ff,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.62, 3.6, 16),
    hullMaterial,
  );
  body.rotation.x = Math.PI / 2;
  ship.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.4, 16), hullMaterial);
  nose.position.z = -2.46;
  nose.rotation.x = -Math.PI / 2;
  ship.add(nose);

  const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 16),
    accentMaterial,
  );
  cockpit.position.set(0, 0.4, -0.6);
  cockpit.scale.set(1.15, 0.62, 0.9);
  ship.add(cockpit);

  const wingGeometry = new THREE.BoxGeometry(1.6, 0.1, 0.8);
  const leftWing = new THREE.Mesh(wingGeometry, hullMaterial);
  leftWing.position.set(-0.95, -0.08, 0);
  leftWing.rotation.z = 0.1;
  ship.add(leftWing);

  const rightWing = leftWing.clone();
  rightWing.position.x = 0.95;
  rightWing.rotation.z = -0.1;
  ship.add(rightWing);

  const engineFlare = new THREE.Mesh(
    new THREE.ConeGeometry(0.34, 1.25, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffcc88,
      transparent: true,
      opacity: 0.72,
    }),
  );
  engineFlare.position.z = 2.4;
  engineFlare.rotation.x = Math.PI / 2;
  ship.add(engineFlare);

  const shipLight = new THREE.PointLight(0x9adfff, 2.2, 26, 2);
  shipLight.position.set(0, 0.2, -0.8);
  ship.add(shipLight);

  ship.scale.setScalar(0.8);
  scene.add(ship);

  state.ship = ship;
  state.engineFlare = engineFlare;
  state.shipLight = shipLight;
}

function buildBoundary() {
  clearGroup(groups.boundary);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(LOCAL_BUBBLE_RADIUS_LY, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0x66b8ff,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    }),
  );

  const cubeEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(LOCAL_BUBBLE_RADIUS_LY * 2, LOCAL_BUBBLE_RADIUS_LY * 2, LOCAL_BUBBLE_RADIUS_LY * 2)),
    new THREE.LineBasicMaterial({
      color: 0x8be5ff,
      transparent: true,
      opacity: 0.2,
    }),
  );

  groups.boundary.add(sphere, cubeEdges);
  groups.boundary.visible = boundaryToggle.checked;
}

function updateShip(delta) {
  if (!state.ship) {
    return;
  }

  const yawInput = Number(keys.has("KeyA")) - Number(keys.has("KeyD"));
  const pitchInput = Number(keys.has("ArrowUp")) - Number(keys.has("ArrowDown"));
  const rollInput = Number(keys.has("KeyQ")) - Number(keys.has("KeyE"));
  const thrustInput = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
  const boost = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 1.75 : 1;

  state.ship.rotateY(yawInput * delta * 1.18);
  state.ship.rotateX(pitchInput * delta * 0.92);
  state.ship.rotateZ(rollInput * delta * 1.35);

  const forward = tmpA.set(0, 0, -1).applyQuaternion(state.ship.quaternion).normalize();

  state.velocity.addScaledVector(forward, thrustInput * delta * 18 * boost);
  state.velocity.multiplyScalar(Math.exp(-delta * 1.18));

  const maxSpeed = 42 * boost;
  if (state.velocity.length() > maxSpeed) {
    state.velocity.setLength(maxSpeed);
  }

  state.ship.position.addScaledVector(state.velocity, delta);

  const distanceFromCenter = state.ship.position.length();
  if (distanceFromCenter > LOCAL_BUBBLE_RADIUS_LY + 8) {
    state.ship.position.setLength(LOCAL_BUBBLE_RADIUS_LY + 8);
    state.velocity.multiplyScalar(0.5);
    setStatus("Limite de la zone jouable atteinte. La suite naturelle est de streamer un chunk voisin.");
  } else if (distanceFromCenter > LOCAL_BUBBLE_RADIUS_LY - 5) {
    state.velocity.addScaledVector(
      state.ship.position.clone().normalize().multiplyScalar(-6),
      delta,
    );
  }

  const flareScale = THREE.MathUtils.lerp(
    0.6,
    1.55,
    Math.min(1, Math.abs(thrustInput) * 0.55 + state.velocity.length() / 35),
  );
  state.engineFlare.scale.setScalar(flareScale);
  state.engineFlare.material.opacity = THREE.MathUtils.lerp(0.4, 0.9, flareScale / 1.55);
  state.shipLight.intensity = THREE.MathUtils.lerp(1.4, 3.2, Math.min(1, state.velocity.length() / 28));
}

function updateCamera(delta) {
  const forward = tmpA.set(0, 0, -1).applyQuaternion(state.ship.quaternion).normalize();
  const up = tmpB.set(0, 1, 0).applyQuaternion(state.ship.quaternion).normalize();
  const right = tmpC.set(1, 0, 0).applyQuaternion(state.ship.quaternion).normalize();

  cameraTarget
    .copy(state.ship.position)
    .addScaledVector(forward, -10.5)
    .addScaledVector(up, 4.2)
    .addScaledVector(right, pointer.x * 0.9);

  camera.position.lerp(cameraTarget, 1 - Math.exp(-delta * 3.8));

  lookTarget
    .copy(state.ship.position)
    .addScaledVector(forward, 12)
    .addScaledVector(up, pointer.y * 1.8);

  camera.lookAt(lookTarget);
}

function updateDeepSky(elapsed) {
  groups.deepSky.children.forEach((child, index) => {
    if (child.isSprite) {
      child.material.rotation = elapsed * child.userData.spin;
      child.position.y = child.userData.anchorY + Math.sin(elapsed * 0.25 + index) * 5;
    }
  });
}

function updateSelection() {
  raycaster.setFromCamera(pointer, camera);
  const [gaiaHit] = state.syntheticPoints
    ? raycaster.intersectObject(state.syntheticPoints)
    : [];

  if (gaiaHit) {
    const hovered = state.syntheticStars[gaiaHit.index];
    if (hovered) {
      setSelectedStar(hovered);
      return;
    }
  }

  if (state.namedPoints) {
    const [namedHit] = raycaster.intersectObject(state.namedPoints);
    if (namedHit) {
      const hovered = state.namedStars[namedHit.index];
      if (hovered) {
        setSelectedStar(hovered);
        return;
      }
    }
  }

  let closestStar = null;
  let closestDistance = Infinity;

  const proximityPool = state.labelStars.length > 0 ? state.labelStars : state.namedStars;
  proximityPool.forEach((star) => {
    const distance = state.ship.position.distanceTo(star.position);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestStar = star;
    }
  });

  if (closestStar && closestDistance < 8) {
    setSelectedStar(closestStar);
  }
}

function updateHud() {
  hudSpeed.textContent = `${state.velocity.length().toFixed(1)} u/s`;
  hudPosition.textContent = `${state.ship.position.x.toFixed(1)}, ${state.ship.position.y.toFixed(1)}, ${state.ship.position.z.toFixed(1)}`;
  hudDistance.textContent = `${state.ship.position.length().toFixed(1)} a.l.`;
}

function resetShip(initial = false) {
  state.ship.position.set(0, 3, 24);
  state.ship.rotation.set(0, 0, 0);
  state.velocity.set(0, 0, 0);
  pointer.set(0, 0);

  if (!initial) {
    setSelectedStar(state.namedStars[0] ?? null);
  }
}

function moveShipToSunView() {
  state.ship.position.set(6, 2.5, 16);
  state.ship.rotation.set(0.02, -0.2, 0);
  state.velocity.set(0, 0, 0);
}

function handlePointerMove(event) {
  pointer.x = (event.offsetX / sceneRoot.clientWidth) * 2 - 1;
  pointer.y = -((event.offsetY / sceneRoot.clientHeight) * 2 - 1);
}

function onKeyDown(event) {
  if (["ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "KeyR") {
    resetShip();
    return;
  }

  keys.add(event.code);
}

function onResize() {
  const width = Math.max(sceneRoot.clientWidth, 1);
  const height = Math.max(sceneRoot.clientHeight, 1);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function refreshDensityLabel() {
  densityValue.textContent = densityRange.value;
}

function refreshSizeLabel() {
  sizeValue.textContent = `${Number.parseFloat(sizeRange.value).toFixed(1)}x`;
}

function applySizeScale() {
  starMaterial.uniforms.uSizeScale.value = Number.parseFloat(sizeRange.value);
}

function setStatus(message) {
  statusText.textContent = message;
}

async function loadGaiaCatalog() {
  try {
    const response = await fetch("./data/generated/gaia-nearby-stars.json", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload.stars) || payload.stars.length === 0) {
      throw new Error("Empty Gaia catalog");
    }

    state.gaiaCatalog = payload.stars;
    state.gaiaMeta = payload.meta ?? null;
    hudSource.textContent = "Gaia DR3";
    setStatus(
      `${payload.stars.length.toLocaleString("fr-FR")} etoiles Gaia chargees pour la zone locale. Le bubble est maintenant pilote par de vraies donnees.`,
    );
  } catch (error) {
    console.info("Gaia catalog not loaded, fallback to synthetic field.", error);
    state.gaiaCatalog = [];
    state.gaiaMeta = null;
    hudSource.textContent = "Catalogue local";
    setStatus(
      "Bubble local initialise. Lance le script Gaia pour remplacer le fond synthetique par de vraies etoiles proches.",
    );
  }
}

function setSelectedStar(star) {
  if (!star) {
    return;
  }

  state.selectedStar = star;
  selectedName.textContent = star.displayName ?? star.name;
  selectedName.style.color = star.colorHex ?? "#f5f8ff";

  const distanceFromShipLy = state.ship
    ? state.ship.position.distanceTo(star.position)
    : 0;

  selectedMeta.textContent = formatSelectedStarMeta(star, distanceFromShipLy);
}

function createSunAnchor() {
  const sun = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffd98b,
    }),
  );

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture(),
      color: 0xffc96f,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glow.scale.set(13, 13, 1);

  const light = new THREE.PointLight(0xffcf8c, 1.6, 90, 2);

  sun.add(core, glow, light);
  return sun;
}

function clearGroup(group) {
  while (group.children.length > 0) {
    const child = group.children.pop();
    group.remove(child);

    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else if (child.material !== starMaterial) {
        child.material.dispose();
      }
    }
  }
}

function createStarMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSizeScale: { value: 1 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uSizeScale;
      attribute float aSize;
      attribute float aBrightness;
      attribute float aTwinkle;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vBrightness;

      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float twinkle = 0.82 + 0.18 * sin(uTime * (0.55 + aTwinkle * 1.5) + aTwinkle * 12.0);
        vAlpha = twinkle;
        vBrightness = aBrightness;
        float distanceScale = 160.0 / max(12.0, -mvPosition.z);
        float brightnessBoost = mix(0.72, 1.75, clamp(aBrightness, 0.0, 1.0));
        gl_PointSize = max(1.0, aSize * uSizeScale * brightnessBoost * twinkle * distanceScale);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vBrightness;

      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        float alpha = smoothstep(0.52, 0.05, d) * vAlpha * mix(0.35, 1.0, clamp(vBrightness, 0.0, 1.0));
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });
}

function createBackgroundHalo() {
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(1200, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0x040712,
      side: THREE.BackSide,
    }),
  );

  return halo;
}

function createNebulaSprites(random) {
  const shellRadius = 340;
  const texture = createCloudTexture();
  const sprites = [];

  for (let index = 0; index < 6; index += 1) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(random() * 2 - 1);
    const radius = shellRadius + (random() - 0.5) * 18;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        color: temperatureToColor(2800 + random() * 5200),
        transparent: true,
        opacity: 0.08 + random() * 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );

    sprite.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    );
    const scale = 70 + random() * 110;
    sprite.scale.set(scale, scale * (0.55 + random() * 0.5), 1);
    sprite.userData = {
      anchorY: sprite.position.y,
      spin: 0.05 + random() * 0.06,
    };
    sprites.push(sprite);
  }

  return sprites;
}

function createCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.35)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.18, "rgba(255,238,180,0.8)");
  gradient.addColorStop(0.5, "rgba(255,180,84,0.3)");
  gradient.addColorStop(1, "rgba(255,150,70,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function createLabelSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 96;
  const context = canvas.getContext("2d");

  context.fillStyle = "rgba(5, 10, 24, 0.75)";
  roundRect(context, 8, 18, 368, 60, 18);
  context.fill();

  context.strokeStyle = "rgba(139, 229, 255, 0.35)";
  context.lineWidth = 2;
  roundRect(context, 8, 18, 368, 60, 18);
  context.stroke();

  context.fillStyle = "#f5f8ff";
  context.font = "600 28px 'IBM Plex Sans'";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 192, 48);

  const texture = new THREE.CanvasTexture(canvas);
  return new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function formatSelectedStarMeta(star, distanceFromShipLy) {
  const viewMagnitude = estimateApparentMagnitude(distanceFromShipLy, star.luminositySolarResolved);
  const viewBrightness = apparentMagnitudeToVisualBrightness(viewMagnitude);
  const brightnessPercent = Math.round(viewBrightness * 100);
  const parts = [
    star.type,
    `${star.distanceLy.toFixed(2)} a.l. du Soleil`,
    `${Math.round(star.temperatureK)} K`,
    `${star.radiusSolar.toFixed(2)} Rsol`,
    `${distanceFromShipLy.toFixed(1)} a.l. du vaisseau`,
    `${brightnessLabelFromMagnitude(viewMagnitude)} (mag ${viewMagnitude.toFixed(1)}, ${brightnessPercent}%)`,
  ];

  if (star.radiusSource === "radius_flame") {
    parts.push("rayon Gaia");
  }

  if (star.colorSource === "teff_gspphot_blackbody") {
    parts.push("couleur Gaia");
  } else if (star.colorSource === "bp_rp_estimate_blackbody") {
    parts.push("couleur estimee");
  }

  if (star.displayName && star.name && star.displayName !== star.name) {
    parts.push(star.name);
  }

  return parts.join(" | ");
}

function rgbToThreeColor(rgb) {
  return new THREE.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255);
}

function estimateLuminosityFromRadiusAndTemperature(radiusSolar, temperatureK) {
  const safeRadius = Math.max(radiusSolar ?? 1, 0.01);
  const safeTemperature = Math.max(temperatureK ?? 5772, 1000);
  return Math.max(
    0.000001,
    Math.pow(safeRadius, 2) * Math.pow(safeTemperature / 5772, 4),
  );
}

function estimateAbsoluteMagnitude(luminositySolar) {
  return 4.83 - 2.5 * Math.log10(Math.max(luminositySolar, 0.000001));
}

function estimateApparentMagnitude(distanceLy, luminositySolar) {
  if (!Number.isFinite(distanceLy) || distanceLy <= 0.00001) {
    return -26.74;
  }

  const distancePc = Math.max(distanceLy / 3.26156, 0.000001);
  return estimateAbsoluteMagnitude(luminositySolar) + 5 * (Math.log10(distancePc) - 1);
}

function apparentMagnitudeToVisualBrightness(apparentMagnitude) {
  if (!Number.isFinite(apparentMagnitude)) {
    return 0.4;
  }

  return THREE.MathUtils.clamp(
    0.12 + Math.exp(-0.23 * (apparentMagnitude + 1.5)),
    0.08,
    1,
  );
}

function brightnessLabelFromMagnitude(apparentMagnitude) {
  if (apparentMagnitude <= 0) {
    return "eclat extreme";
  }
  if (apparentMagnitude <= 3) {
    return "tres brillante";
  }
  if (apparentMagnitude <= 6) {
    return "brillante";
  }
  if (apparentMagnitude <= 9) {
    return "visible";
  }
  if (apparentMagnitude <= 12) {
    return "faible";
  }
  return "tres faible";
}

function applyKnownNameToGaiaStar(star) {
  const match = findKnownNamedStarFor(star);
  if (!match || match.name === "Soleil") {
    return star;
  }

  return {
    ...star,
    displayName: match.name,
  };
}

function findKnownNamedStarFor(star, maxDistanceLy = 0.75) {
  const cartesian = star.distanceLy === 0
    ? { x: 0, y: 0, z: 0 }
    : sphericalToCartesian(star.distanceLy, star.raDeg, star.decDeg);
  const position = Number.isFinite(star.x) && Number.isFinite(star.y) && Number.isFinite(star.z)
    ? new THREE.Vector3(star.x, star.y, star.z)
    : new THREE.Vector3(cartesian.x, cartesian.y, cartesian.z);

  let bestMatch = null;
  let bestDistance = Infinity;

  state.namedStars.forEach((namedStar) => {
    if (namedStar.name === "Soleil") {
      return;
    }

    const distance = namedStar.position.distanceTo(position);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = namedStar;
    }
  });

  return bestDistance <= maxDistanceLy ? bestMatch : null;
}

function temperatureToColor(temperature) {
  const kelvin = temperature / 100;
  let red;
  let green;
  let blue;

  if (kelvin <= 66) {
    red = 255;
    green = 99.4708025861 * Math.log(kelvin) - 161.1195681661;
    blue = kelvin <= 19 ? 0 : 138.5177312231 * Math.log(kelvin - 10) - 305.0447927307;
  } else {
    red = 329.698727446 * Math.pow(kelvin - 60, -0.1332047592);
    green = 288.1221695283 * Math.pow(kelvin - 60, -0.0755148492);
    blue = 255;
  }

  return new THREE.Color(
    THREE.MathUtils.clamp(red, 0, 255) / 255,
    THREE.MathUtils.clamp(green, 0, 255) / 255,
    THREE.MathUtils.clamp(blue, 0, 255) / 255,
  );
}

function mulberry32(seed) {
  let current = seed >>> 0;

  return () => {
    current |= 0;
    current = (current + 0x6d2b79f5) | 0;
    let t = Math.imul(current ^ (current >>> 15), 1 | current);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
