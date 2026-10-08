export type ScreenState =
  | 'MAIN_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'MISSION_COMPLETE'
  | 'GAME_OVER'
  | 'UPGRADES'
  | 'MISSIONS'
  | 'HOW_TO_PLAY';

export type AIState = 'PATROL' | 'SUSPICIOUS' | 'CHASE';

export type HidingType =
  | 'DENSE_FOREST'
  | 'ABANDONED_SHED'
  | 'SMALL_HUT'
  | 'ROCKS'
  | 'BUSHES';

export interface Vector2D {
  x: number;
  y: number;
}

export interface TimberPile {
  id: string;
  x: number;
  y: number;
  amount: number;
  maxAmount: number;
  valuePerUnit: number;
}

export interface HidingSpot {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: HidingType;
  label: string;
}

export interface CargoTruck {
  id: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  maxSpeed: number;
  cargo: number;
  maxCargo: number;
  condition: number;
  maxCondition: number;
  name: string;
}

export interface NPCUnit {
  id: string;
  type: 'POLICE_OFFICER' | 'POLICE_JEEP' | 'RIVAL_SMUGGLER';
  name: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  patrolSpeed: number;
  chaseSpeed: number;
  visionRange: number;
  visionAngle: number; // in radians
  state: AIState;
  suspicionTimer: number;
  waypoints: Vector2D[];
  currentWaypointIndex: number;
  lastKnownPlayerPos: Vector2D | null;
  stunTimer: number;
}

export interface CheckpointZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  hasBarrier: boolean;
  barrierOpen: boolean;
}

export interface ObstacleRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'RIVER' | 'ROCK_WALL' | 'DENSE_TREES' | 'VILLAGE_HUT' | 'ROADBLOCK';
  blocksPlayer?: boolean;
  blocksVehicle?: boolean;
  slowsPlayer?: boolean;
}

export interface RoadSegment {
  points: Vector2D[];
  width: number;
  type: 'MAIN_ROAD' | 'DIRT_TRAIL' | 'BRIDGE';
}

export interface SafeZone {
  x: number;
  y: number;
  radius: number;
  name: string;
  temporarilyLockedUntil?: number;
}

export interface LevelConfig {
  id: number;
  code: string;
  title: string;
  subtitle: string;
  locationName: string;
  timeOfDay: 'DAY' | 'DUSK' | 'MIST' | 'NIGHT' | 'STORM';
  targetTimber: number;
  baseReward: number;
  reputationReward: number;
  timeLimitSeconds: number;
  description: string;
  objectiveText: string;
  mapWidth: number;
  mapHeight: number;
  playerSpawn: Vector2D;
  safeZone: SafeZone;
  roads: RoadSegment[];
  obstacles: ObstacleRect[];
  checkpoints: CheckpointZone[];
  timberPiles: TimberPile[];
  hidingSpots: HidingSpot[];
  trucks: CargoTruck[];
  npcs: NPCUnit[];
  treeClusters: { x: number; y: number; radius: number; density: number }[];
}

export type UpgradeKey =
  | 'speed'
  | 'cargoCapacity'
  | 'stealth'
  | 'stamina'
  | 'vehicle'
  | 'reputation';

export type UpgradeLevels = Record<UpgradeKey, number>;

export interface UpgradeDefinition {
  key: UpgradeKey;
  name: string;
  tagline: string;
  description: string;
  baseCost: number;
  costMultiplier: number;
  maxLevel: number;
  unitLabel: string;
  getEffectText: (level: number) => string;
}

export interface ContextualAction {
  id: string;
  label: string;
  keyHint: string;
  type:
    | 'COLLECT'
    | 'HIDE'
    | 'LEAVE_HIDE'
    | 'ENTER_VEHICLE'
    | 'EXIT_VEHICLE'
    | 'DELIVER'
    | 'INTERACT_CHECKPOINT';
  targetId?: string;
  worldPos?: Vector2D;
}

export interface MissionResult {
  levelId: number;
  success: boolean;
  reason: string;
  cargoDelivered: number;
  cargoLost: number;
  moneyEarned: number;
  moneyLost: number;
  timeSeconds: number;
  policeAlerts: number;
  reputationEarned: number;
}

export interface RandomEventNotification {
  id: string;
  title: string;
  detail: string;
  type: 'WARNING' | 'OPPORTUNITY' | 'INFO';
  timestamp: number;
}

export interface GameSettings {
  soundEnabled: boolean;
  showMiniMap: boolean;
  touchControlsMode: 'AUTO' | 'ALWAYS' | 'OFF';
  cameraOverview: boolean;
}
