// Physics constants
export const GRAVITY = -20;
export const BASE_DRAG = 0.02;
export const GROUND_FRICTION = 0.05;
export const BOUNCE_DAMPING = 0.6;
export const TUMBLE_SLOWDOWN = 0.98; // Speed multiplier when tumbling without wheels

// Launch constants
export const MIN_PULL_DISTANCE = 0.5;
export const MAX_PULL_DISTANCE = 10;
export const LAUNCH_POWER_MULTIPLIER = 8;
export const LAUNCH_ANGLE = 20 * (Math.PI / 180); // 20 degrees in radians

// Plane dimensions
export const PLANE_WIDTH = 1;
export const PLANE_HEIGHT = 0.3;
export const PLANE_LENGTH = 2;

// Camera settings
export const CAMERA_OFFSET = { x: 0, y: 5, z: -15 };
export const CAMERA_LERP_SPEED = 0.1;

// Zone definitions
export const ZONES = {
  runway: { start: 0, end: 100, color: 0x555555 },
  city: { start: 100, end: 1000, color: 0x444444 },
  desert: { start: 1000, end: 3000, color: 0xd4a574 },
  forest: { start: 3000, end: 6000, color: 0x228b22 },
} as const;

// Colors
export const COLORS = {
  sky: 0x87ceeb,
  plane: 0xe74c3c,
  slingshot: 0x8b4513,
  rubber: 0x222222,
  runway: 0x555555,
  ground: 0x228b22,
};

// Game states
export type GameState = "ready" | "pulling" | "flying" | "crashed";
