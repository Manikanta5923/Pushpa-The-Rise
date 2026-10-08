import { UpgradeDefinition, UpgradeKey, UpgradeLevels } from '../types/game';

export const INITIAL_UPGRADES: UpgradeLevels = {
  speed: 1,
  cargoCapacity: 1,
  stealth: 1,
  stamina: 1,
  vehicle: 1,
  reputation: 1,
};

export const UPGRADE_DEFINITIONS: UpgradeDefinition[] = [
  {
    key: 'speed',
    name: 'Footwork & Agility',
    tagline: 'Increase walking and running speed across mud and canopy trails.',
    description:
      'Lighter boots and forest pathfinding training allow you to outpace foot patrols even while carrying heavy red timber.',
    baseCost: 1800,
    costMultiplier: 1.55,
    maxLevel: 5,
    unitLabel: 'Speed',
    getEffectText: (lvl) => `+${(lvl - 1) * 14}% Movement Speed`,
  },
  {
    key: 'cargoCapacity',
    name: 'Timber Harness Rig',
    tagline: 'Carry more red timber units on foot before needing extraction.',
    description:
      'Reinforced shoulder ropes and balanced back frames let you haul larger bundles of crimson logs in a single run.',
    baseCost: 2200,
    costMultiplier: 1.65,
    maxLevel: 5,
    unitLabel: 'Capacity',
    getEffectText: (lvl) => `${3 + lvl} Max Timber Logs on Foot`,
  },
  {
    key: 'stealth',
    name: 'Forest Camouflage',
    tagline: 'Reduce police detection speed and blend into cover faster.',
    description:
      'Dark earth-toned wraps and silent movement cut down police vision buildup and double how quickly patrols lose your trail when hidden.',
    baseCost: 2000,
    costMultiplier: 1.6,
    maxLevel: 5,
    unitLabel: 'Stealth',
    getEffectText: (lvl) => `-${(lvl - 1) * 15}% Detection Buildup`,
  },
  {
    key: 'stamina',
    name: 'Endurance Conditioning',
    tagline: 'Run for longer durations and recover breath rapidly.',
    description:
      'High-altitude forest conditioning expands your sprint reservoir and cuts recovery delay after evading checkpoints.',
    baseCost: 1600,
    costMultiplier: 1.5,
    maxLevel: 5,
    unitLabel: 'Stamina',
    getEffectText: (lvl) => `${100 + (lvl - 1) * 30} Max Stamina & Faster Regen`,
  },
  {
    key: 'vehicle',
    name: 'Lorry Chassis & Engine',
    tagline: 'Increase cargo truck speed, timber capacity, and armor condition.',
    description:
      'Tuned diesel injectors, muffled exhaust pipes, and steel-reinforced beds let your forest trucks haul massive loads through roadblocks.',
    baseCost: 2600,
    costMultiplier: 1.65,
    maxLevel: 5,
    unitLabel: 'Vehicle',
    getEffectText: (lvl) => `${7 + lvl * 2} Truck Capacity · +${(lvl - 1) * 15}% Lorry Speed`,
  },
  {
    key: 'reputation',
    name: 'Syndicate Network',
    tagline: 'Unlock higher buyer payouts and insider checkpoint intel.',
    description:
      'Stronger standing with port buyers and village lookouts boosts the rupee value of every delivered red timber log.',
    baseCost: 2400,
    costMultiplier: 1.6,
    maxLevel: 5,
    unitLabel: 'Payout',
    getEffectText: (lvl) => `+${(lvl - 1) * 20}% Rupee Payout & Reputation Bonus`,
  },
];

export function getUpgradeCost(def: UpgradeDefinition, currentLevel: number): number {
  if (currentLevel >= def.maxLevel) return 0;
  return Math.round((def.baseCost * Math.pow(def.costMultiplier, currentLevel - 1)) / 50) * 50;
}

export function getPlayerStats(upgrades: UpgradeLevels) {
  return {
    baseMoveSpeed: 155 * (1 + (upgrades.speed - 1) * 0.14),
    maxFootCargo: 3 + upgrades.cargoCapacity, // Lv1 = 4, Lv2 = 5, Lv3 = 6, Lv4 = 7, Lv5 = 8
    detectionRateMultiplier: Math.max(0.35, 1 - (upgrades.stealth - 1) * 0.15),
    hideDecayMultiplier: 1 + (upgrades.stealth - 1) * 0.25,
    maxStamina: 100 + (upgrades.stamina - 1) * 30,
    staminaRegen: 22 + (upgrades.stamina - 1) * 6,
    truckSpeedMultiplier: 1 + (upgrades.vehicle - 1) * 0.15,
    truckMaxCargo: 7 + upgrades.vehicle * 2, // Lv1 = 9, Lv2 = 11...
    truckMaxCondition: 100 + (upgrades.vehicle - 1) * 25,
    payoutMultiplier: 1 + (upgrades.reputation - 1) * 0.2,
  };
}

export function formatRupees(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export { type UpgradeKey };
