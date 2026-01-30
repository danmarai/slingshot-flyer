export interface UpgradeTier {
  cost: number;
  [key: string]: number;
}

export interface UpgradeDefinition {
  name: string;
  description: string;
  maxTier: number;
  tiers: UpgradeTier[];
  requires?: string; // Upgrade that must be purchased first
}

export const UPGRADES: Record<string, UpgradeDefinition> = {
  wings: {
    name: "Wings",
    description: "Provides lift and enables sustained flight",
    maxTier: 10,
    tiers: [
      { cost: 100, lift: 0.1, control: 0.1 },
      { cost: 250, lift: 0.15, control: 0.15 },
      { cost: 500, lift: 0.2, control: 0.2 },
      { cost: 800, lift: 0.25, control: 0.25 },
      { cost: 1200, lift: 0.3, control: 0.3 },
      { cost: 1800, lift: 0.35, control: 0.35 },
      { cost: 2500, lift: 0.4, control: 0.4 },
      { cost: 3500, lift: 0.45, control: 0.45 },
      { cost: 5000, lift: 0.5, control: 0.5 },
      { cost: 7500, lift: 0.6, control: 0.6 },
    ],
  },
  wheels: {
    name: "Wheels",
    description: "Roll on ground instead of tumbling",
    maxTier: 10,
    requires: "wings",
    tiers: [
      { cost: 150, friction: 0.9 },
      { cost: 350, friction: 0.85 },
      { cost: 600, friction: 0.8 },
      { cost: 900, friction: 0.75 },
      { cost: 1300, friction: 0.7 },
      { cost: 1900, friction: 0.65 },
      { cost: 2700, friction: 0.6 },
      { cost: 3800, friction: 0.55 },
      { cost: 5200, friction: 0.5 },
      { cost: 7000, friction: 0.45 },
    ],
  },
  tail: {
    name: "Tail",
    description: "Adds stability and pitch control",
    maxTier: 10,
    requires: "wings",
    tiers: [
      { cost: 200, stability: 0.1, pitch: 0.1 },
      { cost: 400, stability: 0.15, pitch: 0.15 },
      { cost: 700, stability: 0.2, pitch: 0.2 },
      { cost: 1100, stability: 0.25, pitch: 0.25 },
      { cost: 1600, stability: 0.3, pitch: 0.3 },
      { cost: 2200, stability: 0.35, pitch: 0.35 },
      { cost: 3000, stability: 0.4, pitch: 0.4 },
      { cost: 4000, stability: 0.45, pitch: 0.45 },
      { cost: 5500, stability: 0.5, pitch: 0.5 },
      { cost: 7500, stability: 0.6, pitch: 0.6 },
    ],
  },
  aerodynamic: {
    name: "Aerodynamic",
    description: "Reduces drag and increases glide efficiency",
    maxTier: 10,
    requires: "wings",
    tiers: [
      { cost: 100, dragReduction: 0.05 },
      { cost: 200, dragReduction: 0.1 },
      { cost: 400, dragReduction: 0.15 },
      { cost: 700, dragReduction: 0.2 },
      { cost: 1100, dragReduction: 0.25 },
      { cost: 1600, dragReduction: 0.3 },
      { cost: 2200, dragReduction: 0.35 },
      { cost: 3000, dragReduction: 0.4 },
      { cost: 4000, dragReduction: 0.45 },
      { cost: 5500, dragReduction: 0.5 },
    ],
  },
  slingshot: {
    name: "Slingshot",
    description: "Increases launch power",
    maxTier: 10,
    tiers: [
      { cost: 50, power: 1.1 },
      { cost: 120, power: 1.2 },
      { cost: 250, power: 1.35 },
      { cost: 450, power: 1.5 },
      { cost: 750, power: 1.7 },
      { cost: 1100, power: 1.9 },
      { cost: 1600, power: 2.1 },
      { cost: 2300, power: 2.4 },
      { cost: 3200, power: 2.7 },
      { cost: 4500, power: 3.0 },
    ],
  },
  boosters: {
    name: "Boosters",
    description: "Adds jet boosters for mid-air thrust",
    maxTier: 10,
    requires: "wings",
    tiers: [
      { cost: 300, uses: 1, boost: 15 },
      { cost: 600, uses: 2, boost: 18 },
      { cost: 1000, uses: 3, boost: 21 },
      { cost: 1500, uses: 4, boost: 24 },
      { cost: 2200, uses: 5, boost: 27 },
      { cost: 3000, uses: 6, boost: 30 },
      { cost: 4000, uses: 7, boost: 33 },
      { cost: 5200, uses: 8, boost: 36 },
      { cost: 6800, uses: 9, boost: 39 },
      { cost: 9000, uses: 10, boost: 45 }, // Tier 10: rear rocket!
    ],
  },
};
