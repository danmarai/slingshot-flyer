# Slingshot Flyer - Product Requirements Document

## 1. Overview

Slingshot Flyer is a browser-based launch game where players use a giant slingshot to propel a toy plane down a runway and beyond. Players earn coins based on distance traveled, which they spend on upgrades to fly further. The game features a continuous world spanning four distinct zones, with progression from a simple wingless plane to a fully-equipped aircraft with jet boosters.

## 2. Target Platform

- **Platform:** Desktop web browser
- **Technology:** HTML5/JavaScript with 3D rendering (Three.js)
- **Scope:** Weekend prototype

## 3. Core Gameplay Loop

1. Player clicks and holds on the slingshot, drags back to pull
2. Player releases to launch the toy plane
3. Player controls the plane mid-flight using arrow keys (control improves with upgrades)
4. Player can activate booster with spacebar or left-click for a 50m burst + velocity boost
5. Player dodges obstacles; collision ends the run
6. Run ends on crash; distance converts to coins (1 meter = 1 coin)
7. Player spends coins on upgrades and repeats

## 4. Controls

### 4.1 Launch
- Click and hold on plane/slingshot
- Drag back to increase launch power
- Release to launch

### 4.2 In-Flight
- **Arrow keys:** Left/Right for side-to-side movement
- **Arrow keys:** Up/Down for pitch control (requires wings + tail)
- **Spacebar or Left-click:** Activate booster (50m burst + velocity increase)

### 4.3 Control Progression
- **No upgrades:** Minimal side-to-side nudging while tumbling
- **With wings:** Better lateral control, some lift
- **With wings + tail:** Full flight control (pitch, roll, sustained flight)

## 5. Game World

The game features a continuous world with four distinct zones. Players can unlock checkpoints at zone transitions and choose to start from any unlocked checkpoint or from the beginning for a challenge run.

| Zone | Distance | Obstacles |
|------|----------|-----------|
| Runway | 0 - 100m | Airport workers, cars, lifter vehicles, fuel trucks (sparse) |
| City | 100 - 1,000m | Buildings, other aircraft, cars, pedestrians |
| Desert | 1,000 - 3,000m | Cacti, desert animals, rock formations |
| Forest | 3,000 - 6,000m | Trees, elk, wildlife |
| **End Goal** | 6,000m | Mountain base (victory!) |

## 6. Collision & Crash Behavior

- Hitting any obstacle ends the run immediately
- Plane shows visual damage/breakage on crash
- People ragdoll on impact (comedic effect)
- Camera stays on crash location
- Overlay displays: distance traveled, coins earned
- Player returns to slingshot after dismissing overlay

## 7. Upgrade System

All upgrades have 10 tiers. **Wings must be purchased first**; all other upgrades can be bought in any order after that.

| Upgrade | Effect |
|---------|--------|
| Wings | Provides lift, enables sustained flight, improves lateral control. Required first. |
| Wheels | Allows rolling on ground instead of tumbling; preserves momentum on landing. |
| Tail | Adds stability; combined with wings enables full pitch control (up/down). |
| Aerodynamic | Repeatable stat upgrade. Reduces drag, increases glide efficiency. |
| Slingshot | Increases launch power; higher initial velocity and distance. |
| Boosters | Adds wing jets (tiers 1-9); tier 10 adds rear rocket boosters with fire effect. |

## 8. User Interface

### 8.1 Bottom Navigation Bar

Three tabs always visible at bottom of screen:

1. **Shop (Left)** - Hangar/tarp icon. Cosmetics store (real money). TBD for prototype.
2. **Main Menu (Center)** - Home icon. Launch screen with slingshot view.
3. **Upgrades (Right)** - Gear icon. Spend in-game coins on plane upgrades.

### 8.2 Main Menu / Launch Screen
- Shows slingshot with plane loaded, ready to launch
- Checkpoint selector (once checkpoints are unlocked)
- Current coin balance displayed

### 8.3 In-Flight HUD
- Distance counter (meters)
- Booster indicator (if equipped)
- Current zone indicator

### 8.4 Crash Screen
- Camera remains on crashed plane location
- Overlay shows: distance traveled, coins earned
- Button to return to main menu

## 9. Visual Style

- **Art Style:** Simple vector/flat design with clean geometric shapes and solid colors
- **Camera:** Third-person view, positioned behind and slightly above the plane
- **Camera Behavior:** Follows plane, rotates with turns
- **Effects:** Ragdoll physics on people, plane breakage on crash, fire/jet effects on boosters

## 10. Monetization

- **In-game currency:** Coins earned from distance (1m = 1 coin), spent on upgrades
- **Premium currency:** Real money for cosmetics in Shop (TBD for prototype)

## 11. Success Metrics (Prototype)

- Core launch mechanic feels satisfying
- Upgrade progression is clear and rewarding
- All four zones are playable with distinct visuals
- Controls improve noticeably with upgrades
- Players can reach the mountain base with full upgrades
