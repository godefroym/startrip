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
const sizeMode = document.querySelector("#sizeMode");
const sizeModeValue = document.querySelector("#sizeModeValue");
const zoomRange = document.querySelector("#zoomRange");
const zoomValue = document.querySelector("#zoomValue");
const boundaryToggle = document.querySelector("#boundaryToggle");
const shellToggle = document.querySelector("#shellToggle");
const gasToggle = document.querySelector("#gasToggle");
const exoplanetToggle = document.querySelector("#exoplanetToggle");
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
const PERSISTENT_LABEL_RADIUS_LY = 10;
const AU_TO_LIGHTYEAR = 1.58125074098e-5;
const EXOPLANET_ORBIT_MIN = 0.28;
const EXOPLANET_ORBIT_MAX = 4.2;
const HOT_PLASMA_TEMPERATURE_K = 1100000;
const WARM_PLASMA_TEMPERATURE_K = 12000;

const SIZE_MODE_PROFILES = {
  realistic: {
    label: "Realiste",
    starScale: 0.55,
    sunCoreScale: 0.42,
    sunGlowScale: 0.38,
    sunLightScale: 0.65,
  },
  readable: {
    label: "Lisible",
    starScale: 1,
    sunCoreScale: 0.32,
    sunGlowScale: 0.3,
    sunLightScale: 0.78,
  },
  cinematic: {
    label: "Cinematique",
    starScale: 1.85,
    sunCoreScale: 0.36,
    sunGlowScale: 0.35,
    sunLightScale: 0.92,
  },
};

const groups = {
  boundary: new THREE.Group(),
  deepSky: new THREE.Group(),
  synthetic: new THREE.Group(),
  named: new THREE.Group(),
  exoplanets: new THREE.Group(),
  gas: new THREE.Group(),
  labels: new THREE.Group(),
  selection: new THREE.Group(),
};

scene.add(
  groups.deepSky,
  groups.boundary,
  groups.synthetic,
  groups.named,
  groups.exoplanets,
  groups.gas,
  groups.labels,
  groups.selection,
);
scene.add(createBackgroundHalo());

const ambientLight = new THREE.HemisphereLight(0x8fb7ff, 0x08101d, 0.65);
const keyLight = new THREE.DirectionalLight(0xffdfb0, 1.1);
keyLight.position.set(12, 16, 9);
scene.add(ambientLight, keyLight);
const cloudSpriteTexture = createCloudTexture();
const glowSpriteTexture = createGlowTexture();

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
  exoplanetCatalog: [],
  exoplanetMeta: null,
  exoplanetObjects: [],
  exoplanetCountsByStarId: new Map(),
  exoplanetCountsByName: new Map(),
  gasDensityMap: null,
  labelStars: [],
  labelSignature: "",
  sunAnchor: null,
  selectionLabel: null,
};

const starMaterial = createStarMaterial();

createShip();
buildBoundary();
renderer.domElement.addEventListener("pointermove", handlePointerMove);
renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });
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

sizeMode.addEventListener("change", () => {
  refreshSizeModeLabel();
  applySizeScale();
});

zoomRange.addEventListener("input", () => {
  refreshZoomLabel();
  applyZoom();
});

boundaryToggle.addEventListener("change", () => {
  groups.boundary.visible = boundaryToggle.checked;
});

shellToggle.addEventListener("change", () => {
  groups.deepSky.visible = shellToggle.checked;
});

gasToggle.addEventListener("change", () => {
  groups.gas.visible = gasToggle.checked;
});

exoplanetToggle.addEventListener("change", () => {
  groups.exoplanets.visible = exoplanetToggle.checked;
});

labelsToggle.addEventListener("change", () => {
  updatePersistentLabels(true);
  groups.labels.visible = labelsToggle.checked;
  groups.selection.visible = labelsToggle.checked;
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
  refreshSizeModeLabel();
  refreshZoomLabel();
  await Promise.all([
    loadGaiaCatalog(),
    loadExoplanetCatalog(),
    loadGasDensityMap(),
  ]);
  rebuildSimulation();
  resetShip(true);
  applySizeScale();
  applyZoom();
  animate();
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.033);
  const elapsed = clock.getElapsedTime();

  starMaterial.uniforms.uTime.value = elapsed;
  updateShip(delta);
  updatePersistentLabels();
  updateCamera(delta);
  updateExoplanets(elapsed);
  updateDeepSky(elapsed);
  updateSelection();
  updateHud();

  renderer.render(scene, camera);
}

function rebuildSimulation() {
  prepareNamedStars();
  rebuildSyntheticStars();
  rebuildNamedPresentation();
  rebuildExoplanets();
  rebuildGasLayer();
  rebuildDeepSky();
  applySizeScale();
  applyZoom();
  if (state.selectedStar) {
    setSelectedStar(state.selectedStar);
  }
  hudSource.textContent = state.gaiaCatalog.length > 0
    ? (state.exoplanetCatalog.length > 0 ? "Gaia + NASA" : "Gaia DR3")
    : state.exoplanetCatalog.length > 0
      ? "NASA Exoplanet"
      : "Catalogue local";
  const totalStars = state.gaiaCatalog.length > 0
    ? state.syntheticStars.length + 1
    : state.syntheticStars.length + state.namedStars.length;
  hudStarCount.textContent = totalStars.toLocaleString("fr-FR");
  setStatus(buildSceneStatus());
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
  clearGroup(groups.selection);
  state.labelStars = [];
  state.labelSignature = "";
  state.selectionLabel = null;

  state.sunAnchor = createSunAnchor();
  groups.named.add(state.sunAnchor);

  if (state.gaiaCatalog.length === 0) {
    state.namedPoints = createPointCloud(state.namedStars, {
      sizeMultiplier: 1.4,
      alphaScale: 1,
    });
    state.namedPoints.userData.starPool = state.namedStars;
    groups.named.add(state.namedPoints);
  } else {
    state.namedPoints = null;
  }

  updatePersistentLabels(true);
  setSelectedStar(state.namedStars[0]);
}

function rebuildExoplanets() {
  clearGroup(groups.exoplanets);
  state.exoplanetObjects = [];
  state.exoplanetCountsByStarId = new Map();
  state.exoplanetCountsByName = new Map();

  if (state.exoplanetCatalog.length === 0) {
    groups.exoplanets.visible = exoplanetToggle.checked;
    return;
  }

  const hostLookup = buildExoplanetHostLookup();

  state.exoplanetCatalog.forEach((planet) => {
    const hostStar = matchExoplanetHost(planet, hostLookup);
    const hostPosition = hostStar
      ? hostStar.position
      : new THREE.Vector3(planet.x, planet.y, planet.z);
    const orbitRadius = getExoplanetRenderOrbitRadius(planet);
    const orbitBasis = createOrbitBasis(`${planet.hostName}:${planet.name}`);
    const planetColor = equilibriumTemperatureToPlanetColor(planet.equilibriumTempK);
    const orbitColor = planetColor.clone().lerp(new THREE.Color(0xffffff), 0.35);

    if (hostStar?.sourceId) {
      state.exoplanetCountsByStarId.set(
        hostStar.sourceId,
        (state.exoplanetCountsByStarId.get(hostStar.sourceId) ?? 0) + 1,
      );
    }
    state.exoplanetCountsByName.set(
      hostStar?.displayName ?? hostStar?.name ?? planet.hostName,
      (state.exoplanetCountsByName.get(hostStar?.displayName ?? hostStar?.name ?? planet.hostName) ?? 0) + 1,
    );

    const orbitLine = createOrbitLine(orbitRadius, orbitColor);
    orbitLine.position.copy(hostPosition);
    orbitLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), orbitBasis.normal);
    groups.exoplanets.add(orbitLine);

    const planetSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowSpriteTexture,
        color: planetColor,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const spriteScale = getExoplanetRenderSize(planet);
    planetSprite.scale.set(spriteScale, spriteScale, 1);
    groups.exoplanets.add(planetSprite);

    state.exoplanetObjects.push({
      line: orbitLine,
      sprite: planetSprite,
      hostPosition,
      hostStar,
      radius: orbitRadius,
      phase: hashToUnit(`${planet.name}:phase`) * Math.PI * 2,
      angularSpeed: getExoplanetAngularSpeed(planet.orbitPeriodDays),
      tangentA: orbitBasis.tangentA,
      tangentB: orbitBasis.tangentB,
      eccentricity: THREE.MathUtils.clamp(planet.orbitEccentricity ?? 0, 0, 0.45),
    });
  });

  groups.exoplanets.visible = exoplanetToggle.checked;
}

function rebuildGasLayer() {
  clearGroup(groups.gas);

  const hotBubbleCloud = createLocalHotBubblePoints();
  groups.gas.add(hotBubbleCloud);

  if (state.gasDensityMap) {
    const warmShellCloud = createWarmGasShellFromMap(state.gasDensityMap);
    groups.gas.add(warmShellCloud);
  }

  groups.gas.visible = gasToggle.checked;
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
    tagName: star.tagName
      ?? (!star.synthetic && !star.sourceCatalog && star.name !== "Soleil" ? star.name : null),
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

  const yawInput = Number(keys.has("ArrowLeft") || keys.has("KeyA"))
    - Number(keys.has("ArrowRight") || keys.has("KeyD"));
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
  const zoomNormalized = getZoomNormalized();
  const followDistance = THREE.MathUtils.lerp(12.5, 2.8, zoomNormalized);
  const verticalOffset = THREE.MathUtils.lerp(4.8, 1.15, zoomNormalized);
  const pointerOffset = THREE.MathUtils.lerp(1.15, 0.35, zoomNormalized);
  const lookDistance = THREE.MathUtils.lerp(14, 5.5, zoomNormalized);
  const lookVerticalOffset = THREE.MathUtils.lerp(1.9, 0.6, zoomNormalized);

  cameraTarget
    .copy(state.ship.position)
    .addScaledVector(forward, -followDistance)
    .addScaledVector(up, verticalOffset)
    .addScaledVector(right, pointer.x * pointerOffset);

  camera.position.lerp(cameraTarget, 1 - Math.exp(-delta * 3.8));

  lookTarget
    .copy(state.ship.position)
    .addScaledVector(forward, lookDistance)
    .addScaledVector(up, pointer.y * lookVerticalOffset);

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

function updateExoplanets(elapsed) {
  state.exoplanetObjects.forEach((planet) => {
    const orbitalCompression = 1 - planet.eccentricity * 0.35;
    const angle = planet.phase + elapsed * planet.angularSpeed;
    const radialScale = 1 - planet.eccentricity * Math.cos(angle);

    planet.sprite.position
      .copy(planet.hostPosition)
      .addScaledVector(planet.tangentA, Math.cos(angle) * planet.radius * radialScale)
      .addScaledVector(planet.tangentB, Math.sin(angle) * planet.radius * orbitalCompression);
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

function handleWheel(event) {
  event.preventDefault();

  const currentZoom = Number.parseFloat(zoomRange.value);
  const nextZoom = THREE.MathUtils.clamp(
    currentZoom + Math.sign(event.deltaY) * -0.16,
    Number.parseFloat(zoomRange.min),
    Number.parseFloat(zoomRange.max),
  );

  zoomRange.value = nextZoom.toFixed(1);
  refreshZoomLabel();
  applyZoom();
}

function onKeyDown(event) {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
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

function refreshSizeModeLabel() {
  sizeModeValue.textContent = getSizeModeProfile().label;
}

function refreshZoomLabel() {
  zoomValue.textContent = `${Number.parseFloat(zoomRange.value).toFixed(1)}x`;
}

function applySizeScale() {
  const sliderScale = Number.parseFloat(sizeRange.value);
  const profile = getSizeModeProfile();
  starMaterial.uniforms.uSizeScale.value = sliderScale * profile.starScale;

  if (state.sunAnchor?.userData) {
    const coreScale = profile.sunCoreScale * Math.pow(sliderScale, 0.2);
    const glowScale = state.sunAnchor.userData.baseGlowScale * profile.sunGlowScale;
    state.sunAnchor.userData.core.scale.setScalar(coreScale);
    state.sunAnchor.userData.glow.scale.set(glowScale, glowScale, 1);
    state.sunAnchor.userData.light.intensity =
      state.sunAnchor.userData.baseLightIntensity * profile.sunLightScale;
  }

  updatePersistentLabels(true);
}

function applyZoom() {
  const fov = THREE.MathUtils.lerp(68, 22, getZoomNormalized());
  camera.fov = fov;
  camera.updateProjectionMatrix();
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

async function loadExoplanetCatalog() {
  try {
    const response = await fetch("./data/generated/exoplanets-nearby.json", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload.planets) || payload.planets.length === 0) {
      throw new Error("Empty exoplanet catalog");
    }

    state.exoplanetCatalog = payload.planets;
    state.exoplanetMeta = payload.meta ?? null;
  } catch (error) {
    console.info("Exoplanet catalog not loaded.", error);
    state.exoplanetCatalog = [];
    state.exoplanetMeta = null;
  }
}

async function loadGasDensityMap() {
  try {
    state.gasDensityMap = await readImageData("./data/assets/hi4pi-density.png");
  } catch (error) {
    console.info("HI4PI gas density map not loaded.", error);
    state.gasDensityMap = null;
  }
}

function setSelectedStar(star) {
  if (!star) {
    return;
  }

  const changedStar = state.selectedStar !== star;
  state.selectedStar = star;
  selectedName.textContent = getStarDisplayName(star);
  selectedName.style.color = star.colorHex ?? "#f5f8ff";

  const distanceFromShipLy = state.ship
    ? state.ship.position.distanceTo(star.position)
    : 0;

  selectedMeta.textContent = formatSelectedStarMeta(star, distanceFromShipLy);
  if (changedStar) {
    updateSelectionLabel(star);
  }
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
      map: glowSpriteTexture,
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
  sun.userData = {
    core,
    glow,
    light,
    baseGlowScale: 13,
    baseLightIntensity: 1.6,
  };
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
  const texture = cloudSpriteTexture;
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
  const probeCanvas = document.createElement("canvas");
  const probeContext = probeCanvas.getContext("2d");
  probeContext.font = "600 28px 'IBM Plex Sans'";
  const measuredWidth = Math.ceil(probeContext.measureText(text).width);
  const width = THREE.MathUtils.clamp(measuredWidth + 84, 240, 640);
  const height = 96;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  context.fillStyle = "rgba(5, 10, 24, 0.75)";
  roundRect(context, 8, 18, width - 16, 60, 18);
  context.fill();

  context.strokeStyle = "rgba(139, 229, 255, 0.35)";
  context.lineWidth = 2;
  roundRect(context, 8, 18, width - 16, 60, 18);
  context.stroke();

  context.fillStyle = "#f5f8ff";
  context.font = "600 28px 'IBM Plex Sans'";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  sprite.userData.aspect = width / height;
  return sprite;
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

  if (star.hipId) {
    parts.push(`HIP ${star.hipId}`);
  } else if (star.tycId) {
    parts.push(`TYC ${star.tycId}`);
  } else if (star.designation && star.designation !== star.name) {
    parts.push(star.designation);
  }

  const exoplanetCount = getExoplanetCountForStar(star);
  if (exoplanetCount > 0) {
    parts.push(`${exoplanetCount} exoplanete${exoplanetCount > 1 ? "s" : ""}`);
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
  const catalogLabel = getCatalogLabel(star);
  const match = findKnownNamedStarFor(star);
  if (!match || match.name === "Soleil") {
    return {
      ...star,
      catalogLabel,
    };
  }

  return {
    ...star,
    catalogLabel,
    displayName: match.name,
    tagName: match.name,
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

function getSizeModeProfile() {
  return SIZE_MODE_PROFILES[sizeMode.value] ?? SIZE_MODE_PROFILES.readable;
}

function getCatalogLabel(star) {
  if (star.catalogLabel) {
    return star.catalogLabel;
  }
  if (star.hipId) {
    return `HIP ${star.hipId}`;
  }
  if (star.tycId) {
    return `TYC ${star.tycId}`;
  }
  return star.designation ?? star.name;
}

function getStarDisplayName(star) {
  return star.displayName ?? getCatalogLabel(star);
}

function getPersistentLabelText(star) {
  if (!star) {
    return null;
  }

  return star.tagName ?? getStarDisplayName(star);
}

function getStarTagText(star) {
  if (!star) {
    return null;
  }

  if (star.tagName) {
    return star.tagName;
  }

  if (star.hipId) {
    return `HIP ${star.hipId}`;
  }

  if (star.tycId) {
    return `TYC ${star.tycId}`;
  }

  return null;
}

function getSelectionLabelOffset(star) {
  if (!star) {
    return 2;
  }

  if (star.name === "Soleil") {
    const sunScale = state.sunAnchor?.userData?.core?.scale.x ?? 0.32;
    return 2.8 + sunScale * 4.5;
  }

  return THREE.MathUtils.clamp((star.renderSize ?? 3) * 0.4, 1.5, 4);
}

function getPersistentLabelOffset(star) {
  return getSelectionLabelOffset(star) + (star.name === "Soleil" ? 0.9 : 0.4);
}

function shouldCreatePersistentLabel(star, centerPosition = state.ship?.position) {
  return Boolean(
    star
    && centerPosition
    && centerPosition.distanceTo(star.position) <= PERSISTENT_LABEL_RADIUS_LY
    && getPersistentLabelText(star),
  );
}

function buildPersistentLabelStars(centerPosition = state.ship?.position) {
  const nearbyNamedStars = state.namedStars.filter((star) => (
    shouldCreatePersistentLabel(star, centerPosition)
  ));

  if (state.gaiaCatalog.length === 0) {
    const nearbySyntheticStars = state.syntheticStars.filter((star) => (
      shouldCreatePersistentLabel(star, centerPosition)
    ));
    return [...nearbyNamedStars, ...nearbySyntheticStars];
  }

  const nearbyGaiaStars = state.syntheticStars.filter((star) => (
    shouldCreatePersistentLabel(star, centerPosition)
  ));
  const occupiedLabels = new Set(
    nearbyGaiaStars.map((star) => getPersistentLabelText(star)),
  );
  const unmatchedNamedStars = nearbyNamedStars.filter(
    (star) => !occupiedLabels.has(getPersistentLabelText(star)),
  );

  return [...nearbyGaiaStars, ...unmatchedNamedStars];
}

function getPersistentLabelSignature(stars) {
  return stars
    .map((star) => `${star.sourceId ?? star.name}:${getPersistentLabelText(star)}`)
    .join("|");
}

function updatePersistentLabels(force = false) {
  const centerPosition = state.ship?.position;
  if (!centerPosition) {
    return;
  }

  const nextLabelStars = buildPersistentLabelStars(centerPosition);
  const nextSignature = getPersistentLabelSignature(nextLabelStars);

  state.labelStars = nextLabelStars;

  if (!force && nextSignature === state.labelSignature) {
    groups.labels.visible = labelsToggle.checked;
    groups.selection.visible = labelsToggle.checked;
    return;
  }

  state.labelSignature = nextSignature;
  clearGroup(groups.labels);

  nextLabelStars.forEach((star) => {
    const label = createLabelSprite(getPersistentLabelText(star));
    label.position.copy(star.position).add(new THREE.Vector3(0, getPersistentLabelOffset(star), 0));
    setLabelSpriteScale(label, 2.1);
    groups.labels.add(label);
  });

  groups.labels.visible = labelsToggle.checked;
  groups.selection.visible = labelsToggle.checked;
  updateSelectionLabel(state.selectedStar);
}

function updateSelectionLabel(star) {
  clearGroup(groups.selection);
  state.selectionLabel = null;

  if (!labelsToggle.checked || shouldCreatePersistentLabel(star)) {
    return;
  }

  const text = getStarTagText(star);
  if (!text) {
    return;
  }

  const label = createLabelSprite(text);
  label.position.copy(star.position).add(new THREE.Vector3(0, getSelectionLabelOffset(star), 0));
  setLabelSpriteScale(label, 2.3);
  groups.selection.add(label);
  state.selectionLabel = label;
}

function setLabelSpriteScale(label, height) {
  const aspect = label.userData.aspect ?? 4;
  label.scale.set(height * aspect, height, 1);
}

function getZoomNormalized() {
  const min = Number.parseFloat(zoomRange.min);
  const max = Number.parseFloat(zoomRange.max);
  const current = Number.parseFloat(zoomRange.value);
  return THREE.MathUtils.clamp((current - min) / (max - min), 0, 1);
}

function getExoplanetCountForStar(star) {
  if (!star) {
    return 0;
  }

  if (star.sourceId && state.exoplanetCountsByStarId.has(star.sourceId)) {
    return state.exoplanetCountsByStarId.get(star.sourceId);
  }

  return state.exoplanetCountsByName.get(star.displayName ?? star.name) ?? 0;
}

function buildSceneStatus() {
  const parts = [];

  if (state.gaiaCatalog.length > 0) {
    parts.push(`${state.gaiaCatalog.length.toLocaleString("fr-FR")} etoiles Gaia`);
  } else {
    parts.push("champ stellaire local");
  }

  if (state.exoplanetCatalog.length > 0) {
    parts.push(`${state.exoplanetCatalog.length.toLocaleString("fr-FR")} exoplanetes archivees`);
  }

  if (state.gasDensityMap) {
    parts.push("gaz local hybride HI4PI + plasma chaud");
  } else {
    parts.push("plasma local stylise");
  }

  return `${parts.join(" | ")}.`;
}

function buildExoplanetHostLookup() {
  const lookup = {
    gaiaSourceId: new Map(),
    hipId: new Map(),
    stars: [],
  };

  const candidateStars = [...state.syntheticStars, ...state.namedStars];
  const seenSourceIds = new Set();

  candidateStars.forEach((star) => {
    if (star.sourceId && seenSourceIds.has(star.sourceId)) {
      return;
    }

    if (star.sourceId) {
      seenSourceIds.add(star.sourceId);
      lookup.gaiaSourceId.set(star.sourceId, star);
    }
    if (star.hipId) {
      lookup.hipId.set(star.hipId, star);
    }
    lookup.stars.push(star);
  });

  return lookup;
}

function matchExoplanetHost(planet, hostLookup) {
  if (planet.gaiaSourceId && hostLookup.gaiaSourceId.has(planet.gaiaSourceId)) {
    return hostLookup.gaiaSourceId.get(planet.gaiaSourceId);
  }

  if (planet.hipId && hostLookup.hipId.has(planet.hipId)) {
    return hostLookup.hipId.get(planet.hipId);
  }

  const hostPosition = new THREE.Vector3(planet.x, planet.y, planet.z);
  let bestMatch = null;
  let bestDistance = Infinity;

  hostLookup.stars.forEach((star) => {
    const distance = star.position.distanceTo(hostPosition);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = star;
    }
  });

  return bestDistance <= 0.22 ? bestMatch : null;
}

function getExoplanetRenderOrbitRadius(planet) {
  if (!Number.isFinite(planet.orbitSemiMajorAxisAu) || planet.orbitSemiMajorAxisAu <= 0) {
    return EXOPLANET_ORBIT_MIN;
  }

  const realOrbitLy = planet.orbitSemiMajorAxisAu * AU_TO_LIGHTYEAR;
  const scaledRadius = Math.pow(realOrbitLy / AU_TO_LIGHTYEAR, 0.35) * 0.95;
  return THREE.MathUtils.clamp(scaledRadius, EXOPLANET_ORBIT_MIN, EXOPLANET_ORBIT_MAX);
}

function getExoplanetRenderSize(planet) {
  if (!Number.isFinite(planet.radiusEarth) || planet.radiusEarth <= 0) {
    return 0.22;
  }

  return THREE.MathUtils.clamp(Math.pow(planet.radiusEarth, 0.45) * 0.14, 0.16, 0.54);
}

function getExoplanetAngularSpeed(orbitPeriodDays) {
  if (!Number.isFinite(orbitPeriodDays) || orbitPeriodDays <= 0) {
    return Math.PI / 16;
  }

  const compressedPeriodSeconds = THREE.MathUtils.clamp(
    5 + Math.log10(orbitPeriodDays + 1) * 10,
    6,
    34,
  );
  return (Math.PI * 2) / compressedPeriodSeconds;
}

function createOrbitBasis(seed) {
  const phi = hashToUnit(`${seed}:phi`) * Math.PI * 2;
  const cosTheta = THREE.MathUtils.lerp(-0.82, 0.82, hashToUnit(`${seed}:theta`));
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
  const normal = new THREE.Vector3(
    Math.cos(phi) * sinTheta,
    cosTheta,
    Math.sin(phi) * sinTheta,
  ).normalize();

  const reference = Math.abs(normal.y) > 0.92
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const tangentA = new THREE.Vector3().crossVectors(normal, reference).normalize();
  const tangentB = new THREE.Vector3().crossVectors(normal, tangentA).normalize();

  return { normal, tangentA, tangentB };
}

function createOrbitLine(radius, color) {
  const segments = 48;
  const positions = [];

  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
    }),
  );
}

function createLocalHotBubblePoints() {
  const random = mulberry32(241);
  const positions = [];
  const colors = [];
  const sizes = [];
  const texture = cloudSpriteTexture;
  const hotColor = plasmaTemperatureToVisibleColor(HOT_PLASMA_TEMPERATURE_K);

  for (let index = 0; index < 1800; index += 1) {
    const direction = randomUnitVector(random);
    const radius = THREE.MathUtils.lerp(16, 78, Math.pow(random(), 0.82));
    const position = new THREE.Vector3(
      direction.x * radius * 0.95,
      direction.y * radius * 0.72,
      direction.z * radius * 1.08,
    );

    positions.push(position.x, position.y, position.z);

    const color = hotColor.clone().offsetHSL(0.01 - random() * 0.02, 0, random() * 0.08 - 0.03);
    colors.push(color.r, color.g, color.b);
    sizes.push(5 + random() * 11);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      map: texture,
      size: 8.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function createWarmGasShellFromMap(imageData) {
  const positions = [];
  const colors = [];
  const sizes = [];
  const texture = cloudSpriteTexture;
  const warmColor = plasmaTemperatureToVisibleColor(WARM_PLASMA_TEMPERATURE_K);
  const { data, width, height } = imageData;
  const random = mulberry32(907);

  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const offset = (y * width + x) * 4;
      const luminance = (
        data[offset] * 0.2126
        + data[offset + 1] * 0.7152
        + data[offset + 2] * 0.0722
      ) / 255;

      if (luminance < 0.1 || random() > luminance * 0.62) {
        continue;
      }

      const lon = (x / width) * Math.PI * 2 - Math.PI;
      const lat = Math.PI / 2 - (y / height) * Math.PI;
      const baseVector = galacticToEquatorialVector(lon, lat);
      const radialJitter = THREE.MathUtils.lerp(52, 96, Math.pow(random(), 0.92));
      const shellPosition = baseVector.multiplyScalar(radialJitter);

      positions.push(shellPosition.x, shellPosition.y, shellPosition.z);

      const color = warmColor.clone().lerp(
        new THREE.Color(1, 0.72, 0.42),
        THREE.MathUtils.clamp(Math.pow(luminance, 1.2) * 0.38, 0, 0.38),
      );
      colors.push(color.r, color.g, color.b);
      sizes.push(4 + luminance * 12);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      map: texture,
      size: 6.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function readImageData(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      resolve(context.getImageData(0, 0, image.width, image.height));
    };
    image.onerror = reject;
    image.src = url;
  });
}

function galacticToEquatorialVector(longitude, latitude) {
  const galacticVector = new THREE.Vector3(
    Math.cos(latitude) * Math.cos(longitude),
    Math.cos(latitude) * Math.sin(longitude),
    Math.sin(latitude),
  );

  const rotation = new THREE.Matrix3().set(
    -0.0548755604, -0.8734370902, -0.4838350155,
    0.4941094279, -0.44482963, 0.7469822445,
    -0.867666149, -0.1980763734, 0.4559837762,
  );

  return galacticVector.applyMatrix3(rotation).normalize();
}

function plasmaTemperatureToVisibleColor(temperatureK) {
  const peakNm = 2897771 / Math.max(temperatureK, 1);

  if (peakNm < 90) {
    return new THREE.Color(0.3, 0.82, 1);
  }
  if (peakNm < 200) {
    return new THREE.Color(0.48, 0.62, 1);
  }
  if (peakNm < 380) {
    return new THREE.Color(0.68, 0.5, 1);
  }
  if (peakNm <= 780) {
    return wavelengthToColor(peakNm);
  }
  if (peakNm <= 1400) {
    return new THREE.Color(1, 0.58, 0.28);
  }

  return new THREE.Color(1, 0.32, 0.18);
}

function wavelengthToColor(wavelengthNm) {
  const wavelength = THREE.MathUtils.clamp(wavelengthNm, 380, 780);
  let red = 0;
  let green = 0;
  let blue = 0;

  if (wavelength < 440) {
    red = -(wavelength - 440) / (440 - 380);
    blue = 1;
  } else if (wavelength < 490) {
    green = (wavelength - 440) / (490 - 440);
    blue = 1;
  } else if (wavelength < 510) {
    green = 1;
    blue = -(wavelength - 510) / (510 - 490);
  } else if (wavelength < 580) {
    red = (wavelength - 510) / (580 - 510);
    green = 1;
  } else if (wavelength < 645) {
    red = 1;
    green = -(wavelength - 645) / (645 - 580);
  } else {
    red = 1;
  }

  let factor = 1;
  if (wavelength < 420) {
    factor = 0.3 + 0.7 * (wavelength - 380) / (420 - 380);
  } else if (wavelength > 700) {
    factor = 0.3 + 0.7 * (780 - wavelength) / (780 - 700);
  }

  return new THREE.Color(red * factor, green * factor, blue * factor);
}

function equilibriumTemperatureToPlanetColor(temperatureK) {
  if (!Number.isFinite(temperatureK)) {
    return new THREE.Color(0.72, 0.88, 1);
  }
  if (temperatureK < 220) {
    return new THREE.Color(0.64, 0.84, 1);
  }
  if (temperatureK < 420) {
    return new THREE.Color(0.8, 0.95, 1);
  }
  if (temperatureK < 800) {
    return new THREE.Color(1, 0.8, 0.45);
  }
  return new THREE.Color(1, 0.56, 0.3);
}

function randomUnitVector(random) {
  const z = random() * 2 - 1;
  const theta = random() * Math.PI * 2;
  const radial = Math.sqrt(1 - z * z);
  return new THREE.Vector3(
    radial * Math.cos(theta),
    z,
    radial * Math.sin(theta),
  );
}

function hashToUnit(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 1000000) / 1000000;
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
