# Slingshot Flyer - Technical Design Document

## 1. Technology Stack

| Component | Technology |
|-----------|------------|
| Rendering | Three.js (WebGL) |
| Physics | Cannon.js or custom physics |
| Language | JavaScript (ES6+) or TypeScript |
| Build Tool | Vite or Webpack |
| UI Framework | HTML/CSS overlay on canvas |
| Data Persistence | localStorage for save data |

## 2. Architecture Overview

The game uses a modular architecture with clear separation between game state, rendering, physics, and UI systems.

### 2.1 Core Systems

- **GameManager:** Central controller managing game state, scene transitions, and system coordination
- **SceneManager:** Handles Three.js scene, camera, renderer setup and management
- **PhysicsEngine:** Manages physics simulation, collision detection, and ragdoll effects
- **InputManager:** Handles mouse/touch input for slingshot and keyboard input for flight controls
- **UIManager:** Controls HUD, menus, and overlays
- **SaveManager:** Handles localStorage read/write for player progress

### 2.2 Game Objects

- **Plane:** Player-controlled aircraft with upgradeable components
- **Slingshot:** Launch mechanism with upgradeable power
- **Obstacle:** Base class for all collidable objects
- **Zone:** Environment container with unique terrain and obstacle spawning rules
- **Person:** NPC with ragdoll physics on collision

## 3. Suggested File Structure

```
slingshot-flyer/
├── index.html
├── src/
│   ├── main.js              # Entry point
│   ├── managers/
│   │   ├── GameManager.js
│   │   ├── SceneManager.js
│   │   ├── PhysicsEngine.js
│   │   ├── InputManager.js
│   │   ├── UIManager.js
│   │   └── SaveManager.js
│   ├── objects/
│   │   ├── Plane.js
│   │   ├── Slingshot.js
│   │   ├── Obstacle.js
│   │   └── Person.js
│   ├── zones/
│   │   ├── Zone.js           # Base class
│   │   ├── RunwayZone.js
│   │   ├── CityZone.js
│   │   ├── DesertZone.js
│   │   └── ForestZone.js
│   ├── upgrades/
│   │   └── UpgradeSystem.js
│   ├── ui/
│   │   ├── HUD.js
│   │   ├── UpgradeMenu.js
│   │   └── CrashOverlay.js
│   └── config/
│       ├── constants.js      # Game constants
│       └── upgradeData.js    # Upgrade definitions
├── assets/
│   ├── models/               # 3D models (if any)
│   └── textures/             # Textures (if any)
└── styles/
    └── main.css
```

## 4. Data Models

### 4.1 Player Save Data

```json
{
  "coins": 0,
  "highestDistance": 0,
  "unlockedCheckpoints": ["runway"],
  "upgrades": {
    "wings": 0,
    "wheels": 0,
    "tail": 0,
    "aerodynamic": 0,
    "slingshot": 0,
    "boosters": 0
  }
}
```

### 4.2 Upgrade Configuration

```javascript
// Each upgrade tier: { cost: number, effect: object }
wings: [
  { cost: 100, lift: 0.1, control: 0.1 },   // Tier 1
  { cost: 250, lift: 0.15, control: 0.15 }, // Tier 2
  { cost: 500, lift: 0.2, control: 0.2 },   // Tier 3
  // ... up to Tier 10
]
```

## 5. Physics System

### 5.1 Core Physics Properties

- **Gravity:** Constant downward force (adjustable for game feel)
- **Drag:** Air resistance, reduced by aerodynamic upgrades
- **Lift:** Upward force when moving forward with wings, scales with speed and wing tier
- **Friction:** Ground friction, reduced by wheel upgrades

### 5.2 Launch Mechanics

- Pull distance maps to launch velocity (with slingshot multiplier)
- Launch angle fixed at ~15-20 degrees above horizontal
- Visual rubber band stretch feedback

### 5.3 Flight Behavior by Upgrade State

| State | Behavior |
|-------|----------|
| No upgrades | Tumbles, bounces on ground, minimal control. Arrow keys nudge slightly. |
| With wheels | Rolls on ground instead of tumbling. Preserves momentum on landing. |
| With wings | Gains lift, stays airborne longer. Better lateral (left/right) control. |
| Wings + Tail | Full flight control. Pitch (up/down) enabled. Can sustain level flight. |
| With boosters | Spacebar/click activates 50m thrust + major velocity boost. Wing jets visible; rear rockets at tier 10. |

## 6. Collision System

- Use bounding boxes or spheres for fast collision detection
- Collision with any obstacle triggers crash state
- On crash: freeze plane physics, apply visual damage, lock distance
- Person obstacles: trigger ragdoll animation on collision

## 7. Camera System

- **Position:** Behind and above plane (third-person chase camera)
- **Following:** Smooth lerp to follow plane position
- **Rotation:** Camera rotates with plane yaw for turning
- **On crash:** Camera stops following, remains at crash location
- **Suggested offset:** (0, 5, -15) relative to plane

## 8. Zone System

### 8.1 Zone Streaming

- Load zone geometry and obstacles as player approaches
- Unload previous zone when sufficiently far behind
- Pre-generate obstacle positions for each zone based on distance

### 8.2 Zone Definitions

| Zone | Range | Ground Color | Obstacle Types |
|------|-------|--------------|----------------|
| Runway | 0-100m | Gray asphalt | Workers, cars, lifters, fuel trucks |
| City | 100-1000m | Gray roads, green parks | Buildings, aircraft, cars, people |
| Desert | 1000-3000m | Sandy tan | Cacti, animals, rocks |
| Forest | 3000-6000m | Green grass | Trees, elk, wildlife |

## 9. UI Implementation

- Use HTML/CSS overlay on top of Three.js canvas
- Bottom nav bar: fixed position, z-index above game
- HUD elements: distance counter, zone indicator, booster status
- Upgrade menu: grid of upgrade cards with tier progress and cost
- Crash overlay: semi-transparent background with stats and continue button

## 10. Performance Considerations

- Use simple geometric shapes (boxes, cylinders, spheres) for obstacles
- Implement object pooling for frequently spawned obstacles
- Use instanced meshes for repeated objects (trees, cacti)
- Cull objects behind the camera
- Target 60 FPS on mid-range hardware
- Use flat shading (no complex lighting) for vector art style

## 11. Implementation Priority (Prototype)

1. **Phase 1:** Basic launch mechanic, plane physics, single zone (runway)
2. **Phase 2:** Camera system, basic controls, collision detection
3. **Phase 3:** Coin system, save/load, upgrade menu (just wings + slingshot)
4. **Phase 4:** Remaining upgrades, improved flight physics
5. **Phase 5:** Additional zones (city, desert, forest)
6. **Phase 6:** Checkpoints, polish, booster visuals, crash effects
