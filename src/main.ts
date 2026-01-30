import * as THREE from "three";
import {
  GRAVITY,
  BASE_DRAG,
  BOUNCE_DAMPING,
  TUMBLE_SLOWDOWN,
  MIN_PULL_DISTANCE,
  MAX_PULL_DISTANCE,
  LAUNCH_POWER_MULTIPLIER,
  LAUNCH_ANGLE,
  PLANE_WIDTH,
  PLANE_HEIGHT,
  PLANE_LENGTH,
  CAMERA_OFFSET,
  CAMERA_LERP_SPEED,
  ZONES,
  COLORS,
  type GameState,
} from "./config/constants.ts";

// Game state
let gameState: GameState = "ready";
let coins = 0;
let distance = 0;

// Three.js objects
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let plane: THREE.Group;
let slingshot: THREE.Group;
let rubberBandLeft: THREE.Line;
let rubberBandRight: THREE.Line;
let ground: THREE.Mesh;

// Physics state
let velocity = new THREE.Vector3();
let angularVelocity = new THREE.Vector3();
const planePosition = new THREE.Vector3(0, 1, 0);
const planeRotation = new THREE.Euler();

// Input state
let isDragging = false;
let pullDistance = 0;
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

  // Set initial camera position
  updateCamera(true);

  // Event listeners
  window.addEventListener("resize", onWindowResize);
  canvas.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  continueBtn.addEventListener("click", resetGame);

  // Load saved coins
  loadProgress();
  updateCoinDisplay();

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

  // Calculate pull distance (drag down and back)
  const deltaY = pullCurrent.y - pullStart.y;
  pullDistance = Math.min(MAX_PULL_DISTANCE, Math.max(0, deltaY / 50));

  // Move plane back based on pull
  plane.position.z = slingshotPosition.z - pullDistance;
  plane.position.y = slingshotHeight - pullDistance * 0.3;

  updateRubberBands();
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

function launch() {
  gameState = "flying";
  launchInstructions.classList.add("hidden");
  hudElement.classList.remove("hidden");

  // Calculate launch velocity
  const power = pullDistance * LAUNCH_POWER_MULTIPLIER;

  velocity.set(
    0,
    Math.sin(LAUNCH_ANGLE) * power,
    Math.cos(LAUNCH_ANGLE) * power,
  );

  // Add some tumble
  angularVelocity.set(
    (Math.random() - 0.5) * 2,
    0,
    (Math.random() - 0.5) * 0.5,
  );

  // Hide rubber bands during flight
  rubberBandLeft.visible = false;
  rubberBandRight.visible = false;
}

function updatePhysics(deltaTime: number) {
  if (gameState !== "flying") return;

  // Apply gravity
  velocity.y += GRAVITY * deltaTime;

  // Apply drag
  const speed = velocity.length();
  const dragForce = speed * speed * BASE_DRAG;
  if (speed > 0) {
    velocity.multiplyScalar(1 - dragForce * deltaTime);
  }

  // Update position
  plane.position.add(velocity.clone().multiplyScalar(deltaTime));

  // Update rotation (tumbling)
  plane.rotation.x += angularVelocity.x * deltaTime;
  plane.rotation.z += angularVelocity.z * deltaTime;

  // Ground collision
  if (plane.position.y <= PLANE_HEIGHT / 2) {
    plane.position.y = PLANE_HEIGHT / 2;

    if (velocity.y < -1) {
      // Bounce
      velocity.y = -velocity.y * BOUNCE_DAMPING;
      // Lose forward speed on tumble
      velocity.z *= TUMBLE_SLOWDOWN;
      // Increase tumble on bounce
      angularVelocity.x += (Math.random() - 0.5) * 3;
    } else {
      velocity.y = 0;
      // Ground friction
      velocity.z *= 0.98;
    }
  }

  // Update distance
  distance = Math.max(0, plane.position.z);

  // Check if stopped
  if (velocity.length() < 0.5 && plane.position.y <= PLANE_HEIGHT / 2 + 0.1) {
    crash();
  }

  // Update HUD
  updateHUD();
}

function updateHUD() {
  distanceDisplay.textContent = `${Math.floor(distance)}m`;

  // Determine zone
  let zoneName = "Runway";
  if (distance >= ZONES.forest.start) zoneName = "Forest";
  else if (distance >= ZONES.desert.start) zoneName = "Desert";
  else if (distance >= ZONES.city.start) zoneName = "City";

  zoneDisplay.textContent = zoneName;
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

function resetGame() {
  gameState = "ready";
  distance = 0;

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
    upgrades: {
      wings: 0,
      wheels: 0,
      tail: 0,
      aerodynamic: 0,
      slingshot: 0,
      boosters: 0,
    },
  };
  localStorage.setItem("slingshotFlyer", JSON.stringify(saveData));
}

function loadProgress() {
  const saved = localStorage.getItem("slingshotFlyer");
  if (saved) {
    const data = JSON.parse(saved);
    coins = data.coins || 0;
  }
}

function getSavedHighestDistance(): number {
  const saved = localStorage.getItem("slingshotFlyer");
  if (saved) {
    const data = JSON.parse(saved);
    return data.highestDistance || 0;
  }
  return 0;
}

let lastTime = 0;
function animate(time = 0) {
  requestAnimationFrame(animate);

  const deltaTime = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  updatePhysics(deltaTime);

  if (gameState === "flying") {
    updateCamera();
  }

  renderer.render(scene, camera);
}

// Start the game
init();
