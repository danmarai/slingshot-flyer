import * as THREE from "three";
import {
  GRAVITY,
  BASE_DRAG,
  BOUNCE_DAMPING,
  TUMBLE_SLOWDOWN,
  MIN_PULL_DISTANCE,
  MAX_PULL_DISTANCE,
  LAUNCH_POWER_MULTIPLIER,
  PLANE_WIDTH,
  PLANE_HEIGHT,
  PLANE_LENGTH,
  CAMERA_OFFSET,
  CAMERA_LERP_SPEED,
  ZONES,
  COLORS,
  type GameState,
} from "./config/constants.ts";
import { UPGRADES } from "./config/upgradeData.ts";

// Game state
let gameState: GameState = "ready";
let coins = 0;
let distance = 0;
let boosterUsesRemaining = 0;

// Upgrade levels (0 = not purchased, 1-10 = tier)
const upgrades = {
  wings: 0,
  wheels: 0,
  tail: 0,
  aerodynamic: 0,
  slingshot: 0,
  boosters: 0,
};

// Checkpoints
const checkpoints = {
  runway: true, // Always unlocked
  city: false,
  desert: false,
  forest: false,
};
let currentCheckpoint: keyof typeof checkpoints = "runway";
let highestDistanceThisRun = 0;
let startingZ = 0; // Track where we launched from

// Keyboard input state
const keys = {
  left: false,
  right: false,
  up: false,
  down: false,
  boost: false,
};

// Three.js objects
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let plane: THREE.Group;
let slingshot: THREE.Group;
let rubberBandLeft: THREE.Line;
let rubberBandRight: THREE.Line;
let ground: THREE.Mesh;

// Booster effects
let boosterParticles: THREE.Points | null = null;
let boosterActive = false;
let boosterTimer = 0;
const BOOSTER_DURATION = 0.5; // seconds

// Obstacles
interface Obstacle {
  mesh: THREE.Object3D;
  boundingBox: THREE.Box3;
  type: string;
}
const obstacles: Obstacle[] = [];

// Physics state
let velocity = new THREE.Vector3();
let angularVelocity = new THREE.Vector3();
const planePosition = new THREE.Vector3(0, 1, 0);

// Input state
let isDragging = false;
let pullDistance = 0;
let launchAngle = 0.5; // 0 = flat, 1 = steep (controlled by vertical drag)
const pullStart = new THREE.Vector2();
const pullCurrent = new THREE.Vector2();

// Slingshot position
const slingshotPosition = new THREE.Vector3(0, 0, 0);
const slingshotHeight = 3;
const slingshotWidth = 4;

// DOM elements
let distanceDisplay: HTMLElement;
let zoneDisplay: HTMLElement;
let launchInstructions: HTMLElement;
let crashOverlay: HTMLElement;
let crashDistance: HTMLElement;
let crashCoins: HTMLElement;
let continueBtn: HTMLElement;
let hudElement: HTMLElement;
let coinCount: HTMLElement;
let upgradeMenu: HTMLElement;
let upgradeGrid: HTMLElement;
let upgradesBtn: HTMLElement;
let closeUpgradesBtn: HTMLElement;
let playBtn: HTMLElement;
let boosterDisplay: HTMLElement;
let boosterCount: HTMLElement;
let checkpointSelector: HTMLElement;
let checkpointButtons: NodeListOf<HTMLElement>;

function init() {
  // Get DOM elements
  distanceDisplay = document.getElementById("distance-display")!;
  zoneDisplay = document.getElementById("zone-display")!;
  launchInstructions = document.getElementById("launch-instructions")!;
  crashOverlay = document.getElementById("crash-overlay")!;
  crashDistance = document.getElementById("crash-distance")!;
  crashCoins = document.getElementById("crash-coins")!;
  continueBtn = document.getElementById("continue-btn")!;
  hudElement = document.getElementById("hud")!;
  coinCount = document.getElementById("coin-count")!;
  upgradeMenu = document.getElementById("upgrade-menu")!;
  upgradeGrid = document.getElementById("upgrade-grid")!;
  upgradesBtn = document.getElementById("upgrades-btn")!;
  closeUpgradesBtn = document.getElementById("close-upgrades")!;
  playBtn = document.getElementById("play-btn")!;
  boosterDisplay = document.getElementById("booster-display")!;
  boosterCount = document.getElementById("booster-count")!;
  checkpointSelector = document.getElementById("checkpoint-selector")!;
  checkpointButtons = document.querySelectorAll(
    ".checkpoint-btn",
  ) as NodeListOf<HTMLElement>;

  // Set up Three.js
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.sky);

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    10000,
  );

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 100, 50);
  scene.add(directionalLight);

  // Create game objects
  createGround();
  createSlingshot();
  createPlane();
  createObstacles();

  // Set initial camera position
  updateCamera(true);

  // Event listeners
  window.addEventListener("resize", onWindowResize);
  canvas.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  continueBtn.addEventListener("click", resetGame);
  upgradesBtn.addEventListener("click", openUpgradeMenu);
  closeUpgradesBtn.addEventListener("click", closeUpgradeMenu);
  playBtn.addEventListener("click", closeUpgradeMenu);

  // Checkpoint button handlers
  checkpointButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const checkpoint = btn.dataset.checkpoint as keyof typeof checkpoints;
      if (checkpoints[checkpoint]) {
        selectCheckpoint(checkpoint);
      }
    });
  });

  // Load saved coins and upgrades
  loadProgress();
  updateCoinDisplay();
  updatePlaneVisuals();

  // Start game loop
  animate();
}

function createGround() {
  // Create runway (0-100m)
  const runwayGeometry = new THREE.PlaneGeometry(20, 100);
  const runwayMaterial = new THREE.MeshLambertMaterial({
    color: ZONES.runway.color,
  });
  const runway = new THREE.Mesh(runwayGeometry, runwayMaterial);
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(0, 0, 50);
  scene.add(runway);

  // Add runway markings
  const markingGeometry = new THREE.PlaneGeometry(0.5, 10);
  const markingMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let z = 10; z < 100; z += 20) {
    const marking = new THREE.Mesh(markingGeometry, markingMaterial);
    marking.rotation.x = -Math.PI / 2;
    marking.position.set(0, 0.01, z);
    scene.add(marking);
  }

  // Create extended ground for other zones
  const groundGeometry = new THREE.PlaneGeometry(200, 6100);
  const groundMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.ground,
  });
  ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.01, 3050);
  scene.add(ground);

  // Add zone color sections
  createZoneGround("city", ZONES.city, 0x444444);
  createZoneGround("desert", ZONES.desert, 0xd4a574);
  createZoneGround("forest", ZONES.forest, 0x228b22);
}

function createZoneGround(
  _name: string,
  zone: { start: number; end: number },
  color: number,
) {
  const length = zone.end - zone.start;
  const geometry = new THREE.PlaneGeometry(200, length);
  const material = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.001, zone.start + length / 2);
  scene.add(mesh);
}

function createSlingshot() {
  slingshot = new THREE.Group();

  // Slingshot frame - two posts
  const postGeometry = new THREE.CylinderGeometry(
    0.15,
    0.2,
    slingshotHeight,
    8,
  );
  const postMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.slingshot,
  });

  const leftPost = new THREE.Mesh(postGeometry, postMaterial);
  leftPost.position.set(-slingshotWidth / 2, slingshotHeight / 2, 0);
  slingshot.add(leftPost);

  const rightPost = new THREE.Mesh(postGeometry, postMaterial);
  rightPost.position.set(slingshotWidth / 2, slingshotHeight / 2, 0);
  slingshot.add(rightPost);

  // Crossbar at base
  const baseGeometry = new THREE.BoxGeometry(slingshotWidth + 0.4, 0.3, 0.3);
  const base = new THREE.Mesh(baseGeometry, postMaterial);
  base.position.set(0, 0.15, 0);
  slingshot.add(base);

  slingshot.position.copy(slingshotPosition);
  scene.add(slingshot);

  // Rubber bands (will be updated dynamically)
  const rubberMaterial = new THREE.LineBasicMaterial({
    color: COLORS.rubber,
    linewidth: 3,
  });

  const leftGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-slingshotWidth / 2, slingshotHeight, 0),
    new THREE.Vector3(0, 1, 0),
  ]);
  rubberBandLeft = new THREE.Line(leftGeometry, rubberMaterial);
  scene.add(rubberBandLeft);

  const rightGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(slingshotWidth / 2, slingshotHeight, 0),
    new THREE.Vector3(0, 1, 0),
  ]);
  rubberBandRight = new THREE.Line(rightGeometry, rubberMaterial);
  scene.add(rubberBandRight);
}

function createPlane() {
  plane = new THREE.Group();

  // Fuselage (main body)
  const fuselageGeometry = new THREE.BoxGeometry(
    PLANE_WIDTH * 0.4,
    PLANE_HEIGHT,
    PLANE_LENGTH,
  );
  const fuselageMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.plane,
  });
  const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
  plane.add(fuselage);

  // Nose cone
  const noseGeometry = new THREE.ConeGeometry(
    PLANE_HEIGHT * 0.6,
    PLANE_LENGTH * 0.3,
    8,
  );
  const noseMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const nose = new THREE.Mesh(noseGeometry, noseMaterial);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = PLANE_LENGTH / 2 + PLANE_LENGTH * 0.15;
  plane.add(nose);

  // Simple tail fin
  const tailGeometry = new THREE.BoxGeometry(
    0.05,
    PLANE_HEIGHT * 2,
    PLANE_LENGTH * 0.3,
  );
  const tailMaterial = new THREE.MeshLambertMaterial({ color: COLORS.plane });
  const tail = new THREE.Mesh(tailGeometry, tailMaterial);
  tail.position.set(0, PLANE_HEIGHT * 0.5, -PLANE_LENGTH / 2);
  plane.add(tail);

  plane.position.copy(planePosition);
  scene.add(plane);
}

function createObstacles() {
  // Clear existing obstacles
  obstacles.forEach((obs) => scene.remove(obs.mesh));
  obstacles.length = 0;

  // Runway obstacles (sparse) - 0-100m
  createRunwayObstacles();

  // City obstacles - 100-1000m
  createCityObstacles();

  // Desert obstacles - 1000-3000m
  createDesertObstacles();

  // Forest obstacles - 3000-6000m
  createForestObstacles();
}

function createRunwayObstacles() {
  // Airport workers
  for (let i = 0; i < 5; i++) {
    const x = (Math.random() - 0.5) * 16;
    const z = 20 + Math.random() * 70;
    createPerson(x, z, 0xffa500); // Orange vest workers
  }

  // Airport vehicles
  for (let i = 0; i < 3; i++) {
    const x = (Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 3);
    const z = 30 + Math.random() * 60;
    createVehicle(x, z, 0xffff00, 2, 1.5, 4); // Yellow airport vehicles
  }
}

function createCityObstacles() {
  // Buildings along the sides
  for (let z = 120; z < 1000; z += 40 + Math.random() * 30) {
    const side = Math.random() > 0.5 ? 1 : -1;
    const x = side * (15 + Math.random() * 20);
    const height = 10 + Math.random() * 40;
    const width = 8 + Math.random() * 12;
    const depth = 8 + Math.random() * 12;
    createBuilding(x, z, width, height, depth);
  }

  // Street level obstacles (cars, people)
  for (let z = 110; z < 1000; z += 15 + Math.random() * 20) {
    const x = (Math.random() - 0.5) * 20;

    if (Math.random() > 0.5) {
      createVehicle(x, z, getRandomCarColor(), 2, 1.2, 4);
    } else {
      createPerson(x, z, getRandomColor());
    }
  }
}

function createDesertObstacles() {
  // Cacti
  for (let z = 1050; z < 3000; z += 20 + Math.random() * 40) {
    const x = (Math.random() - 0.5) * 80;
    createCactus(x, z);
  }

  // Rock formations
  for (let z = 1100; z < 3000; z += 100 + Math.random() * 100) {
    const x = (Math.random() - 0.5) * 60;
    createRock(x, z);
  }
}

function createForestObstacles() {
  // Trees - denser than desert
  for (let z = 3050; z < 6000; z += 10 + Math.random() * 20) {
    const x = (Math.random() - 0.5) * 100;
    createTree(x, z);
  }

  // Occasional elk
  for (let z = 3200; z < 6000; z += 200 + Math.random() * 300) {
    const x = (Math.random() - 0.5) * 40;
    createElk(x, z);
  }
}

function createPerson(x: number, z: number, shirtColor: number) {
  const group = new THREE.Group();

  // Body
  const bodyGeometry = new THREE.BoxGeometry(0.5, 1, 0.3);
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: shirtColor });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1;
  group.add(body);

  // Head
  const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
  const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = 1.75;
  group.add(head);

  // Legs
  const legGeometry = new THREE.BoxGeometry(0.2, 0.6, 0.2);
  const legMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
  leftLeg.position.set(-0.15, 0.3, 0);
  group.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
  rightLeg.position.set(0.15, 0.3, 0);
  group.add(rightLeg);

  group.position.set(x, 0, z);
  scene.add(group);

  // Create bounding box
  const box = new THREE.Box3().setFromObject(group);
  obstacles.push({ mesh: group, boundingBox: box, type: "person" });
}

function createVehicle(
  x: number,
  z: number,
  color: number,
  width: number,
  height: number,
  length: number,
) {
  const group = new THREE.Group();

  // Car body
  const bodyGeometry = new THREE.BoxGeometry(width, height, length);
  const bodyMaterial = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = height / 2 + 0.3;
  group.add(body);

  // Wheels
  const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
  const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });

  const wheelPositions = [
    [-width / 2, 0.3, length / 3],
    [width / 2, 0.3, length / 3],
    [-width / 2, 0.3, -length / 3],
    [width / 2, 0.3, -length / 3],
  ];

  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    group.add(wheel);
  });

  group.position.set(x, 0, z);
  scene.add(group);

  const box = new THREE.Box3().setFromObject(group);
  obstacles.push({ mesh: group, boundingBox: box, type: "vehicle" });
}

function createBuilding(
  x: number,
  z: number,
  width: number,
  height: number,
  depth: number,
) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshLambertMaterial({
    color: getRandomBuildingColor(),
  });
  const building = new THREE.Mesh(geometry, material);
  building.position.set(x, height / 2, z);
  scene.add(building);

  // Add windows
  const windowGeometry = new THREE.PlaneGeometry(1, 1.5);
  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x87ceeb });

  for (let wy = 3; wy < height - 2; wy += 4) {
    for (let wz = -depth / 2 + 2; wz < depth / 2 - 1; wz += 3) {
      // Front and back windows
      const windowFront = new THREE.Mesh(windowGeometry, windowMaterial);
      windowFront.position.set(x - width / 2 - 0.01, wy, z + wz);
      windowFront.rotation.y = Math.PI / 2;
      scene.add(windowFront);

      const windowBack = new THREE.Mesh(windowGeometry, windowMaterial);
      windowBack.position.set(x + width / 2 + 0.01, wy, z + wz);
      windowBack.rotation.y = -Math.PI / 2;
      scene.add(windowBack);
    }
  }

  const box = new THREE.Box3().setFromObject(building);
  obstacles.push({ mesh: building, boundingBox: box, type: "building" });
}

function createCactus(x: number, z: number) {
  const group = new THREE.Group();

  // Main stem
  const stemGeometry = new THREE.CylinderGeometry(0.3, 0.4, 3, 8);
  const cactusMaterial = new THREE.MeshLambertMaterial({ color: 0x2d5a27 });
  const stem = new THREE.Mesh(stemGeometry, cactusMaterial);
  stem.position.y = 1.5;
  group.add(stem);

  // Arms
  if (Math.random() > 0.3) {
    const armGeometry = new THREE.CylinderGeometry(0.2, 0.25, 1.5, 8);

    const leftArm = new THREE.Mesh(armGeometry, cactusMaterial);
    leftArm.position.set(-0.6, 2, 0);
    leftArm.rotation.z = Math.PI / 4;
    group.add(leftArm);

    if (Math.random() > 0.5) {
      const rightArm = new THREE.Mesh(armGeometry, cactusMaterial);
      rightArm.position.set(0.6, 1.5, 0);
      rightArm.rotation.z = -Math.PI / 4;
      group.add(rightArm);
    }
  }

  group.position.set(x, 0, z);
  scene.add(group);

  const box = new THREE.Box3().setFromObject(group);
  obstacles.push({ mesh: group, boundingBox: box, type: "cactus" });
}

function createRock(x: number, z: number) {
  const size = 2 + Math.random() * 4;
  const geometry = new THREE.DodecahedronGeometry(size, 0);
  const material = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
  const rock = new THREE.Mesh(geometry, material);
  rock.position.set(x, size * 0.6, z);
  rock.rotation.set(Math.random(), Math.random(), Math.random());
  scene.add(rock);

  const box = new THREE.Box3().setFromObject(rock);
  obstacles.push({ mesh: rock, boundingBox: box, type: "rock" });
}

function createTree(x: number, z: number) {
  const group = new THREE.Group();

  // Trunk
  const trunkHeight = 3 + Math.random() * 2;
  const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, trunkHeight, 8);
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = trunkHeight / 2;
  group.add(trunk);

  // Foliage (cone shape for pine trees)
  const foliageHeight = 4 + Math.random() * 3;
  const foliageGeometry = new THREE.ConeGeometry(2, foliageHeight, 8);
  const foliageMaterial = new THREE.MeshLambertMaterial({ color: 0x228b22 });
  const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
  foliage.position.y = trunkHeight + foliageHeight / 2 - 1;
  group.add(foliage);

  group.position.set(x, 0, z);
  scene.add(group);

  const box = new THREE.Box3().setFromObject(group);
  obstacles.push({ mesh: group, boundingBox: box, type: "tree" });
}

function createElk(x: number, z: number) {
  const group = new THREE.Group();

  // Body
  const bodyGeometry = new THREE.BoxGeometry(1.5, 1.2, 2.5);
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1.5;
  group.add(body);

  // Head
  const headGeometry = new THREE.BoxGeometry(0.6, 0.8, 1);
  const head = new THREE.Mesh(headGeometry, bodyMaterial);
  head.position.set(0, 2, 1.5);
  group.add(head);

  // Antlers
  const antlerGeometry = new THREE.CylinderGeometry(0.05, 0.08, 0.8, 4);
  const antlerMaterial = new THREE.MeshLambertMaterial({ color: 0x3d2817 });

  const leftAntler = new THREE.Mesh(antlerGeometry, antlerMaterial);
  leftAntler.position.set(-0.3, 2.6, 1.3);
  leftAntler.rotation.z = -0.3;
  group.add(leftAntler);

  const rightAntler = new THREE.Mesh(antlerGeometry, antlerMaterial);
  rightAntler.position.set(0.3, 2.6, 1.3);
  rightAntler.rotation.z = 0.3;
  group.add(rightAntler);

  // Legs
  const legGeometry = new THREE.CylinderGeometry(0.1, 0.15, 1, 6);
  const legMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });

  const legPositions = [
    [-0.5, 0.5, 0.8],
    [0.5, 0.5, 0.8],
    [-0.5, 0.5, -0.8],
    [0.5, 0.5, -0.8],
  ];

  legPositions.forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeometry, legMaterial);
    leg.position.set(lx, ly, lz);
    group.add(leg);
  });

  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);

  const box = new THREE.Box3().setFromObject(group);
  obstacles.push({ mesh: group, boundingBox: box, type: "elk" });
}

function getRandomCarColor(): number {
  const colors = [0xff0000, 0x0000ff, 0x00ff00, 0xffffff, 0x000000, 0xffff00];
  return colors[Math.floor(Math.random() * colors.length)];
}

function getRandomBuildingColor(): number {
  const colors = [0x808080, 0xa0a0a0, 0x606060, 0xb0b0b0, 0x909090];
  return colors[Math.floor(Math.random() * colors.length)];
}

function getRandomColor(): number {
  const colors = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181];
  return colors[Math.floor(Math.random() * colors.length)];
}

function checkObstacleCollisions() {
  if (gameState !== "flying") return;

  // Create plane bounding box
  const planeBox = new THREE.Box3().setFromObject(plane);

  for (const obstacle of obstacles) {
    // Only check obstacles that are near the plane
    if (Math.abs(obstacle.mesh.position.z - plane.position.z) > 50) continue;

    // Update obstacle bounding box
    obstacle.boundingBox.setFromObject(obstacle.mesh);

    if (planeBox.intersectsBox(obstacle.boundingBox)) {
      // Collision detected!
      handleCollision(obstacle);
      return;
    }
  }
}

function handleCollision(obstacle: Obstacle) {
  console.log(`Crashed into ${obstacle.type}!`);
  crash();
}

function updateRubberBands() {
  const planePos = plane.position.clone();

  // Left rubber band
  const leftPoints = [
    new THREE.Vector3(
      slingshotPosition.x - slingshotWidth / 2,
      slingshotHeight,
      slingshotPosition.z,
    ),
    planePos,
  ];
  rubberBandLeft.geometry.setFromPoints(leftPoints);

  // Right rubber band
  const rightPoints = [
    new THREE.Vector3(
      slingshotPosition.x + slingshotWidth / 2,
      slingshotHeight,
      slingshotPosition.z,
    ),
    planePos,
  ];
  rubberBandRight.geometry.setFromPoints(rightPoints);
}

function onMouseDown(event: MouseEvent) {
  if (gameState !== "ready") return;

  isDragging = true;
  gameState = "pulling";
  pullStart.set(event.clientX, event.clientY);
  pullCurrent.copy(pullStart);
}

function onMouseMove(event: MouseEvent) {
  if (!isDragging || gameState !== "pulling") return;

  pullCurrent.set(event.clientX, event.clientY);

  // Calculate drag delta
  const deltaX = pullCurrent.x - pullStart.x;
  const deltaY = pullCurrent.y - pullStart.y;

  // Pull distance is total drag distance (mostly vertical matters)
  const totalDrag = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  pullDistance = Math.min(MAX_PULL_DISTANCE, Math.max(0, totalDrag / 20));

  // Launch angle based on drag direction
  // Dragging straight down = medium angle
  // Dragging down-left = higher angle (more vertical)
  // Dragging down-right = lower angle (more horizontal)
  if (totalDrag > 10) {
    // Angle from 15 to 60 degrees based on horizontal component
    // Dragging left (negative deltaX) = higher angle
    const angleInfluence = Math.max(-1, Math.min(1, -deltaX / 200));
    launchAngle = 0.5 + angleInfluence * 0.4; // 0.1 to 0.9
  }

  // Move plane back based on pull - more dramatic visual
  const startZ = getCheckpointStartPosition();
  plane.position.z = startZ - pullDistance * 1.2;
  plane.position.y = slingshotHeight - pullDistance * 0.15 + launchAngle * 0.5;

  // Tilt plane to show launch angle
  plane.rotation.x = -(launchAngle - 0.5) * 0.5;

  updateRubberBands();

  // Update power and angle indicator
  const powerPercent = Math.round((pullDistance / MAX_PULL_DISTANCE) * 100);
  const angleDegrees = Math.round(15 + launchAngle * 50); // 15 to 65 degrees
  launchInstructions.querySelector("p")!.textContent =
    powerPercent > 0
      ? `Power: ${powerPercent}% | Angle: ${angleDegrees}° - Release to launch!`
      : "Drag down to pull back (left/right adjusts angle)";
}

function onMouseUp() {
  if (!isDragging || gameState !== "pulling") return;

  isDragging = false;

  if (pullDistance < MIN_PULL_DISTANCE) {
    // Not enough pull, reset
    resetPlanePosition();
    gameState = "ready";
    return;
  }

  // Launch!
  launch();
}

function onKeyDown(event: KeyboardEvent) {
  switch (event.code) {
    case "ArrowLeft":
    case "KeyA":
      keys.left = true;
      break;
    case "ArrowRight":
    case "KeyD":
      keys.right = true;
      break;
    case "ArrowUp":
    case "KeyW":
      keys.up = true;
      break;
    case "ArrowDown":
    case "KeyS":
      keys.down = true;
      break;
    case "Space":
      if (!keys.boost) {
        keys.boost = true;
        activateBooster();
      }
      break;
  }
}

function onKeyUp(event: KeyboardEvent) {
  switch (event.code) {
    case "ArrowLeft":
    case "KeyA":
      keys.left = false;
      break;
    case "ArrowRight":
    case "KeyD":
      keys.right = false;
      break;
    case "ArrowUp":
    case "KeyW":
      keys.up = false;
      break;
    case "ArrowDown":
    case "KeyS":
      keys.down = false;
      break;
    case "Space":
      keys.boost = false;
      break;
  }
}

function activateBooster() {
  if (gameState !== "flying") return;
  if (upgrades.boosters === 0) return;
  if (boosterUsesRemaining <= 0) return;
  if (boosterActive) return; // Don't allow multiple simultaneous boosts

  boosterUsesRemaining--;

  // Get booster stats
  const boosterTier = UPGRADES.boosters.tiers[upgrades.boosters - 1];
  const boostPower = boosterTier.boost;

  // Add forward velocity boost
  const forward = new THREE.Vector3(0, 0.3, 1).normalize();
  velocity.add(forward.multiplyScalar(boostPower));

  // Start visual effect
  boosterActive = true;
  boosterTimer = BOOSTER_DURATION;
  createBoosterParticles();
}

function createBoosterParticles() {
  // Remove existing particles
  if (boosterParticles) {
    scene.remove(boosterParticles);
    boosterParticles.geometry.dispose();
    (boosterParticles.material as THREE.Material).dispose();
  }

  // Create particle geometry
  const particleCount = 50;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.5;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
    positions[i * 3 + 2] = -Math.random() * 2;

    // Orange to yellow gradient
    colors[i * 3] = 1;
    colors[i * 3 + 1] = 0.3 + Math.random() * 0.5;
    colors[i * 3 + 2] = 0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.3,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
  });

  boosterParticles = new THREE.Points(geometry, material);
  scene.add(boosterParticles);
}

function updateBoosterEffect(deltaTime: number) {
  if (!boosterActive || !boosterParticles) return;

  boosterTimer -= deltaTime;

  if (boosterTimer <= 0) {
    // Remove particles
    boosterActive = false;
    scene.remove(boosterParticles);
    boosterParticles.geometry.dispose();
    (boosterParticles.material as THREE.Material).dispose();
    boosterParticles = null;
    return;
  }

  // Update particle positions to follow plane
  boosterParticles.position.copy(plane.position);
  boosterParticles.position.z -= PLANE_LENGTH / 2;

  // Animate particles
  const positions = boosterParticles.geometry.attributes.position
    .array as Float32Array;
  for (let i = 0; i < positions.length / 3; i++) {
    positions[i * 3 + 2] -= deltaTime * 10; // Move backward

    // Reset particle if too far
    if (positions[i * 3 + 2] < -3) {
      positions[i * 3] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 2] = 0;
    }
  }
  boosterParticles.geometry.attributes.position.needsUpdate = true;

  // Fade out
  (boosterParticles.material as THREE.PointsMaterial).opacity =
    boosterTimer / BOOSTER_DURATION;
}

function launch() {
  gameState = "flying";
  launchInstructions.classList.add("hidden");
  checkpointSelector.classList.add("hidden");
  hudElement.classList.remove("hidden");

  // Calculate launch velocity with slingshot upgrade
  const slingshotMultiplier =
    upgrades.slingshot > 0
      ? UPGRADES.slingshot.tiers[upgrades.slingshot - 1].power
      : 1;

  // Ensure minimum power so launches always go somewhere
  const minPower = 20;
  const basePower = pullDistance * LAUNCH_POWER_MULTIPLIER;
  const power = Math.max(minPower, basePower) * slingshotMultiplier;

  // Calculate actual launch angle from player input (15 to 65 degrees)
  const actualAngle = (15 + launchAngle * 50) * (Math.PI / 180);

  // Get starting position from checkpoint
  const startZ = getCheckpointStartPosition();
  startingZ = startZ; // Remember where we started for distance calculation

  // Position plane at the slingshot (launch point), not behind it
  plane.position.set(0, slingshotHeight, startZ);
  plane.rotation.set(0, 0, 0); // Reset rotation for clean launch

  // Set velocity based on player-controlled angle
  velocity.set(0, Math.sin(actualAngle) * power, Math.cos(actualAngle) * power);

  // Minimal tumble at start - plane should fly cleanly initially
  const tumbleMultiplier = upgrades.wings > 0 ? 0.1 : 0.5;
  angularVelocity.set((Math.random() - 0.5) * tumbleMultiplier, 0, 0);

  // Reset booster uses
  if (upgrades.boosters > 0) {
    boosterUsesRemaining = UPGRADES.boosters.tiers[upgrades.boosters - 1].uses;
  }

  // Reset distance tracking for this run
  highestDistanceThisRun = 0;

  // Reset launch angle for next time
  launchAngle = 0.5;

  // Hide rubber bands during flight
  rubberBandLeft.visible = false;
  rubberBandRight.visible = false;
}

function updatePhysics(deltaTime: number) {
  if (gameState !== "flying") return;

  // Calculate upgrade effects
  const hasWings = upgrades.wings > 0;
  const hasTail = upgrades.tail > 0;
  const hasWheels = upgrades.wheels > 0;

  // Get upgrade stats
  const wingStats = hasWings ? UPGRADES.wings.tiers[upgrades.wings - 1] : null;
  const aeroStats =
    upgrades.aerodynamic > 0
      ? UPGRADES.aerodynamic.tiers[upgrades.aerodynamic - 1]
      : null;
  const wheelStats = hasWheels
    ? UPGRADES.wheels.tiers[upgrades.wheels - 1]
    : null;
  const tailStats = hasTail ? UPGRADES.tail.tiers[upgrades.tail - 1] : null;

  // Apply player controls
  const baseControl = 0.5; // Minimal nudge without upgrades
  const wingControl = wingStats ? wingStats.control * 20 : 0;
  const lateralControl = baseControl + wingControl;

  // Left/Right movement
  if (keys.left) {
    velocity.x += lateralControl * deltaTime;
    plane.rotation.z = Math.max(plane.rotation.z - 2 * deltaTime, -0.3);
  }
  if (keys.right) {
    velocity.x -= lateralControl * deltaTime;
    plane.rotation.z = Math.min(plane.rotation.z + 2 * deltaTime, 0.3);
  }

  // Up/Down pitch control (requires wings + tail)
  if (hasWings && hasTail && tailStats) {
    const pitchControl = tailStats.pitch * 15;
    if (keys.up) {
      velocity.y += pitchControl * deltaTime;
      plane.rotation.x = Math.max(plane.rotation.x - deltaTime, -0.5);
    }
    if (keys.down) {
      velocity.y -= pitchControl * deltaTime * 0.5;
      plane.rotation.x = Math.min(plane.rotation.x + deltaTime, 0.5);
    }
  }

  // Apply gravity
  velocity.y += GRAVITY * deltaTime;

  // Apply lift (if has wings and moving forward)
  if (hasWings && wingStats && velocity.z > 5) {
    const liftForce = wingStats.lift * velocity.z * 0.5;
    velocity.y += liftForce * deltaTime;
  }

  // Apply drag (reduced by aerodynamic upgrade)
  const dragReduction = aeroStats ? aeroStats.dragReduction : 0;
  const effectiveDrag = BASE_DRAG * (1 - dragReduction);
  const speed = velocity.length();
  const dragForce = speed * speed * effectiveDrag;
  if (speed > 0) {
    velocity.multiplyScalar(1 - dragForce * deltaTime);
  }

  // Update position
  plane.position.add(velocity.clone().multiplyScalar(deltaTime));

  // Clamp X position to keep plane on screen
  plane.position.x = Math.max(-50, Math.min(50, plane.position.x));

  // Update rotation (tumbling) - reduced if has wings
  if (!hasWings) {
    plane.rotation.x += angularVelocity.x * deltaTime;
    plane.rotation.z += angularVelocity.z * deltaTime;
  } else {
    // With wings, slowly stabilize
    angularVelocity.multiplyScalar(0.95);
    plane.rotation.x += angularVelocity.x * deltaTime * 0.3;
    // Gradually level out roll when not turning
    if (!keys.left && !keys.right) {
      plane.rotation.z *= 0.95;
    }
  }

  // Ground collision
  if (plane.position.y <= PLANE_HEIGHT / 2) {
    plane.position.y = PLANE_HEIGHT / 2;

    if (velocity.y < -1) {
      // Bounce behavior depends on wheels
      velocity.y = -velocity.y * BOUNCE_DAMPING;

      if (hasWheels && wheelStats) {
        // Wheels: smoother landing, less speed loss
        velocity.z *= wheelStats.friction;
        angularVelocity.set(0, 0, 0);
        plane.rotation.x = 0;
        plane.rotation.z = 0;
      } else {
        // No wheels: tumble and lose more speed
        velocity.z *= TUMBLE_SLOWDOWN;
        angularVelocity.x += (Math.random() - 0.5) * 3;
      }
    } else {
      velocity.y = 0;
      // Ground friction
      if (hasWheels && wheelStats) {
        velocity.z *= 0.995; // Wheels roll nicely
      } else {
        velocity.z *= 0.98; // More friction without wheels
      }
    }
  }

  // Update distance (relative to where we started, but show absolute position for zone display)
  const distanceFromStart = plane.position.z - startingZ;
  distance = Math.max(0, distanceFromStart);
  highestDistanceThisRun = Math.max(highestDistanceThisRun, plane.position.z);

  // Check for checkpoint unlocks
  checkAndUnlockCheckpoints();

  // Check for obstacle collisions
  checkObstacleCollisions();

  // Check for victory (reached mountain base at 6000m)
  if (plane.position.z >= 6000) {
    victory();
    return;
  }

  // Check if stopped
  if (velocity.length() < 0.5 && plane.position.y <= PLANE_HEIGHT / 2 + 0.1) {
    crash();
  }

  // Update HUD
  updateHUD();
}

function updateHUD() {
  distanceDisplay.textContent = `${Math.floor(distance)}m`;

  // Determine zone based on absolute position
  const absolutePosition = startingZ + distance;
  let zoneName = "Runway";
  if (absolutePosition >= ZONES.forest.start) zoneName = "Forest";
  else if (absolutePosition >= ZONES.desert.start) zoneName = "Desert";
  else if (absolutePosition >= ZONES.city.start) zoneName = "City";

  zoneDisplay.textContent = zoneName;

  // Update booster display
  if (upgrades.boosters > 0) {
    boosterDisplay.classList.remove("hidden");
    boosterCount.textContent = boosterUsesRemaining.toString();
  } else {
    boosterDisplay.classList.add("hidden");
  }
}

function updateCamera(instant = false) {
  const targetPosition = new THREE.Vector3(
    plane.position.x + CAMERA_OFFSET.x,
    plane.position.y + CAMERA_OFFSET.y,
    plane.position.z + CAMERA_OFFSET.z,
  );

  if (instant) {
    camera.position.copy(targetPosition);
  } else {
    camera.position.lerp(targetPosition, CAMERA_LERP_SPEED);
  }

  camera.lookAt(plane.position);
}

function crash() {
  gameState = "crashed";

  // Calculate coins earned
  const coinsEarned = Math.floor(distance);
  coins += coinsEarned;
  saveProgress();

  // Show crash overlay
  crashDistance.textContent = Math.floor(distance).toString();
  crashCoins.textContent = coinsEarned.toString();
  crashOverlay.classList.remove("hidden");
  hudElement.classList.add("hidden");

  updateCoinDisplay();
}

function victory() {
  gameState = "crashed"; // Use same state to stop physics

  // Big coin bonus for victory!
  const coinsEarned = Math.floor(distance) + 10000;
  coins += coinsEarned;
  saveProgress();

  // Show victory message
  const crashContent = crashOverlay.querySelector(".crash-content")!;
  crashContent.querySelector("h2")!.textContent = "VICTORY!";
  crashContent.querySelector("h2")!.style.color = "#2ecc71";
  crashDistance.textContent = "6000+ (Mountain Base!)";
  crashCoins.textContent = coinsEarned.toString();
  crashOverlay.classList.remove("hidden");
  hudElement.classList.add("hidden");

  updateCoinDisplay();
}

function resetGame() {
  gameState = "ready";
  distance = 0;
  highestDistanceThisRun = 0;
  startingZ = 0;

  // Position slingshot at checkpoint
  const startZ = getCheckpointStartPosition();
  slingshotPosition.z = startZ;
  slingshot.position.z = startZ;
  startingZ = startZ;

  // Reset plane
  resetPlanePosition();
  plane.rotation.set(0, 0, 0);
  velocity.set(0, 0, 0);
  angularVelocity.set(0, 0, 0);

  // Reset rubber bands
  rubberBandLeft.visible = true;
  rubberBandRight.visible = true;
  updateRubberBands();

  // Reset UI
  crashOverlay.classList.add("hidden");
  launchInstructions.classList.remove("hidden");
  checkpointSelector.classList.remove("hidden");
  updateCheckpointUI();

  // Reset victory overlay text if needed
  const crashContent = crashOverlay.querySelector(".crash-content")!;
  crashContent.querySelector("h2")!.textContent = "Crashed!";
  crashContent.querySelector("h2")!.style.color = "#e74c3c";

  updateHUD();

  // Reset camera
  updateCamera(true);
}

function resetPlanePosition() {
  plane.position.set(
    slingshotPosition.x,
    slingshotHeight - 0.5,
    slingshotPosition.z,
  );
  pullDistance = 0;
  updateRubberBands();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateCoinDisplay() {
  coinCount.textContent = coins.toString();
}

function saveProgress() {
  const saveData = {
    coins,
    highestDistance: Math.max(distance, getSavedHighestDistance()),
    upgrades: { ...upgrades },
    checkpoints: { ...checkpoints },
  };
  localStorage.setItem("slingshotFlyer", JSON.stringify(saveData));
}

function loadProgress() {
  const saved = localStorage.getItem("slingshotFlyer");
  if (saved) {
    const data = JSON.parse(saved);
    coins = data.coins || 0;
    if (data.upgrades) {
      Object.assign(upgrades, data.upgrades);
    }
    if (data.checkpoints) {
      Object.assign(checkpoints, data.checkpoints);
    }
  }
  updateCheckpointUI();
}

function getSavedHighestDistance(): number {
  const saved = localStorage.getItem("slingshotFlyer");
  if (saved) {
    const data = JSON.parse(saved);
    return data.highestDistance || 0;
  }
  return 0;
}

function selectCheckpoint(checkpoint: keyof typeof checkpoints) {
  if (!checkpoints[checkpoint]) return;

  currentCheckpoint = checkpoint;
  updateCheckpointUI();
}

function updateCheckpointUI() {
  checkpointButtons.forEach((btn) => {
    const checkpoint = btn.dataset.checkpoint as keyof typeof checkpoints;
    const isUnlocked = checkpoints[checkpoint];
    const isActive = checkpoint === currentCheckpoint;

    btn.classList.toggle("locked", !isUnlocked);
    btn.classList.toggle("active", isActive);
  });
}

function checkAndUnlockCheckpoints() {
  let unlocked = false;
  const absolutePosition = startingZ + distance;

  // Unlock city at 100m
  if (absolutePosition >= ZONES.city.start && !checkpoints.city) {
    checkpoints.city = true;
    unlocked = true;
  }

  // Unlock desert at 1000m
  if (absolutePosition >= ZONES.desert.start && !checkpoints.desert) {
    checkpoints.desert = true;
    unlocked = true;
  }

  // Unlock forest at 3000m
  if (absolutePosition >= ZONES.forest.start && !checkpoints.forest) {
    checkpoints.forest = true;
    unlocked = true;
  }

  if (unlocked) {
    saveProgress();
  }
}

function getCheckpointStartPosition(): number {
  switch (currentCheckpoint) {
    case "city":
      return ZONES.city.start;
    case "desert":
      return ZONES.desert.start;
    case "forest":
      return ZONES.forest.start;
    default:
      return 0;
  }
}

function openUpgradeMenu() {
  if (gameState === "flying") return;

  upgradeMenu.classList.remove("hidden");
  launchInstructions.classList.add("hidden");
  renderUpgradeMenu();

  // Update nav button states
  upgradesBtn.classList.add("active");
  playBtn.classList.remove("active");
}

function closeUpgradeMenu() {
  upgradeMenu.classList.add("hidden");
  if (gameState === "ready") {
    launchInstructions.classList.remove("hidden");
  }

  // Update nav button states
  upgradesBtn.classList.remove("active");
  playBtn.classList.add("active");
}

function renderUpgradeMenu() {
  upgradeGrid.innerHTML = "";

  const upgradeOrder = [
    "wings",
    "slingshot",
    "wheels",
    "tail",
    "aerodynamic",
    "boosters",
  ];

  for (const key of upgradeOrder) {
    const upgrade = UPGRADES[key];
    const currentTier = upgrades[key as keyof typeof upgrades];
    const isMaxed = currentTier >= upgrade.maxTier;
    const nextTier = isMaxed ? null : upgrade.tiers[currentTier];
    const requiresMet =
      !upgrade.requires ||
      upgrades[upgrade.requires as keyof typeof upgrades] > 0;
    const canAfford = nextTier ? coins >= nextTier.cost : false;
    const isLocked = !requiresMet;

    const card = document.createElement("div");
    card.className = `upgrade-card${isLocked ? " locked" : ""}${isMaxed ? " maxed" : ""}`;

    // Tier pips
    let tierPips = "";
    for (let i = 0; i < upgrade.maxTier; i++) {
      tierPips += `<div class="tier-pip${i < currentTier ? " filled" : ""}"></div>`;
    }

    card.innerHTML = `
      <div class="upgrade-name">${upgrade.name}</div>
      <div class="upgrade-description">${upgrade.description}</div>
      <div class="upgrade-tier">${tierPips}</div>
      <div class="upgrade-cost">
        <span class="cost-amount">${isMaxed ? "MAX" : `${nextTier?.cost} coins`}</span>
        <button class="upgrade-btn${isMaxed ? " maxed" : ""}"
                data-upgrade="${key}"
                ${isMaxed || isLocked || !canAfford ? "disabled" : ""}>
          ${isMaxed ? "MAXED" : isLocked ? "LOCKED" : canAfford ? "BUY" : "NEED COINS"}
        </button>
      </div>
      ${isLocked ? `<div class="requires-note">Requires: ${UPGRADES[upgrade.requires!].name}</div>` : ""}
    `;

    upgradeGrid.appendChild(card);
  }

  // Add click handlers
  upgradeGrid
    .querySelectorAll(".upgrade-btn:not([disabled])")
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const upgradeKey = target.dataset.upgrade as keyof typeof upgrades;
        purchaseUpgrade(upgradeKey);
      });
    });
}

function purchaseUpgrade(key: keyof typeof upgrades) {
  const upgrade = UPGRADES[key];
  const currentTier = upgrades[key];

  if (currentTier >= upgrade.maxTier) return;

  const cost = upgrade.tiers[currentTier].cost;
  if (coins < cost) return;

  // Check requirements
  if (upgrade.requires) {
    const requiredUpgrade = upgrade.requires as keyof typeof upgrades;
    if (upgrades[requiredUpgrade] === 0) return;
  }

  // Purchase!
  coins -= cost;
  upgrades[key]++;

  saveProgress();
  updateCoinDisplay();
  renderUpgradeMenu();

  // Update plane visuals if needed
  updatePlaneVisuals();
}

function updatePlaneVisuals() {
  // Remove existing visual upgrades
  const toRemove: THREE.Object3D[] = [];
  plane.traverse((child) => {
    if (child.userData.isUpgrade) {
      toRemove.push(child);
    }
  });
  toRemove.forEach((child) => plane.remove(child));

  // Add wings if purchased
  if (upgrades.wings > 0) {
    const wingSpan = 1 + upgrades.wings * 0.2;
    const wingGeometry = new THREE.BoxGeometry(wingSpan * 2, 0.05, 0.8);
    const wingMaterial = new THREE.MeshLambertMaterial({ color: COLORS.plane });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.userData.isUpgrade = true;
    plane.add(wings);
  }

  // Add tail stabilizer if purchased
  if (upgrades.tail > 0) {
    const stabGeometry = new THREE.BoxGeometry(1, 0.05, 0.4);
    const stabMaterial = new THREE.MeshLambertMaterial({ color: COLORS.plane });
    const stabilizer = new THREE.Mesh(stabGeometry, stabMaterial);
    stabilizer.position.set(0, PLANE_HEIGHT * 0.3, -PLANE_LENGTH / 2 + 0.2);
    stabilizer.userData.isUpgrade = true;
    plane.add(stabilizer);
  }

  // Add wheels if purchased
  if (upgrades.wheels > 0) {
    const wheelGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 8);
    const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });

    const wheelPositions = [
      [-0.3, -PLANE_HEIGHT / 2, 0.3],
      [0.3, -PLANE_HEIGHT / 2, 0.3],
      [0, -PLANE_HEIGHT / 2, -0.5],
    ];

    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      wheel.userData.isUpgrade = true;
      plane.add(wheel);
    });
  }

  // Add boosters if purchased
  if (upgrades.boosters > 0) {
    const boosterGeometry = new THREE.CylinderGeometry(0.1, 0.15, 0.4, 8);
    const boosterMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });

    // Wing jets
    if (upgrades.wings > 0) {
      const leftBooster = new THREE.Mesh(boosterGeometry, boosterMaterial);
      leftBooster.rotation.x = Math.PI / 2;
      leftBooster.position.set(-0.8, -0.1, -0.2);
      leftBooster.userData.isUpgrade = true;
      plane.add(leftBooster);

      const rightBooster = new THREE.Mesh(boosterGeometry, boosterMaterial);
      rightBooster.rotation.x = Math.PI / 2;
      rightBooster.position.set(0.8, -0.1, -0.2);
      rightBooster.userData.isUpgrade = true;
      plane.add(rightBooster);
    }

    // Tier 10: rear rocket
    if (upgrades.boosters >= 10) {
      const rocketGeometry = new THREE.CylinderGeometry(0.2, 0.25, 0.6, 8);
      const rocketMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
      const rocket = new THREE.Mesh(rocketGeometry, rocketMaterial);
      rocket.rotation.x = Math.PI / 2;
      rocket.position.set(0, 0, -PLANE_LENGTH / 2 - 0.2);
      rocket.userData.isUpgrade = true;
      plane.add(rocket);
    }
  }
}

let lastTime = 0;
function animate(time = 0) {
  requestAnimationFrame(animate);

  const deltaTime = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  updatePhysics(deltaTime);
  updateBoosterEffect(deltaTime);

  if (gameState === "flying") {
    updateCamera();
  }

  renderer.render(scene, camera);
}

// Start the game
init();
