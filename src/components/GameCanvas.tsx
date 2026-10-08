import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CargoTruck,
  CheckpointZone,
  ContextualAction,
  GameSettings,
  HidingSpot,
  LevelConfig,
  MissionResult,
  NPCUnit,
  ObstacleRect,
  RandomEventNotification,
  TimberPile,
  UpgradeLevels,
  Vector2D,
} from '../types/game';
import { formatRupees, getPlayerStats } from '../data/upgrades';
import { formatTimeMMSS } from './Modals';
import { TouchControls } from './TouchControls';
import { soundFX } from '../utils/sound';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
}

interface GameCanvasProps {
  level: LevelConfig;
  money: number;
  reputation: number;
  upgrades: UpgradeLevels;
  settings: GameSettings;
  isPaused: boolean;
  onPauseToggle: () => void;
  onOpenSettings: () => void;
  onMissionComplete: (result: MissionResult) => void;
  onMissionFailed: (result: MissionResult) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  level,
  money,
  reputation,
  upgrades,
  settings,
  isPaused,
  onPauseToggle,
  onOpenSettings,
  onMissionComplete,
  onMissionFailed,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stats = getPlayerStats(upgrades);

  // React HUD states synced from game loop for crisp UI rendering
  const [hudCargo, setHudCargo] = useState(0);
  const [hudMaxCargo, setHudMaxCargo] = useState(stats.maxFootCargo);
  const [hudDelivered, setHudDelivered] = useState(0);
  const [hudHealth, setHudHealth] = useState(100);
  const [hudStamina, setHudStamina] = useState(stats.maxStamina);
  const [hudDetection, setHudDetection] = useState(0);
  const [hudIsHidden, setHudIsHidden] = useState(false);
  const [hudHideLabel, setHudHideLabel] = useState('');
  const [hudTimeRemaining, setHudTimeRemaining] = useState(level.timeLimitSeconds);
  const [hudAlertBanner, setHudAlertBanner] = useState<{
    text: string;
    tone: 'NORMAL' | 'SUSPICIOUS' | 'ALERT' | 'CHASE' | 'SAFE';
  }>({ text: 'Forest Sector Clear', tone: 'NORMAL' });
  const [hudContextAction, setHudContextAction] = useState<ContextualAction | null>(null);
  const [hudVehicle, setHudVehicle] = useState<{
    name: string;
    speedKmh: number;
    cargo: number;
    maxCargo: number;
    condition: number;
    maxCondition: number;
  } | null>(null);
  const [hudDecoyCooldown, setHudDecoyCooldown] = useState(0);
  const [activeEventToast, setActiveEventToast] = useState<RandomEventNotification | null>(null);
  const [sessionBonusMoney, setSessionBonusMoney] = useState(0);

  // Mutable Game World Ref for 60fps deterministic loop
  const worldRef = useRef<{
    player: {
      x: number;
      y: number;
      angle: number;
      vx: number;
      vy: number;
      speed: number;
      cargo: number;
      cargoValue: number;
      health: number;
      stamina: number;
      isHidden: boolean;
      hideSpotId: string | null;
      hideLabel: string;
      inTruckId: string | null;
      interactionRadius: number;
      walkCycle: number;
      targetWaypoint: Vector2D | null;
      invulnerableTimer: number;
    };
    deliveredTimber: number;
    deliveredValue: number;
    detection: number; // 0 to 100
    peakAlertStage: 'NONE' | 'SUSPICIOUS' | 'CHASE';
    policeAlertsCount: number;
    elapsedTime: number;
    decoyCooldown: number;
    nextRandomEventTime: number;
    safeZoneLockedUntil: number;
    timberPiles: TimberPile[];
    hidingSpots: HidingSpot[];
    trucks: CargoTruck[];
    npcs: NPCUnit[];
    checkpoints: CheckpointZone[];
    obstacles: ObstacleRect[];
    particles: Particle[];
    ambientSpores: { x: number; y: number; vx: number; vy: number; phase: number }[];
    keys: Record<string, boolean>;
    joystickVec: Vector2D;
    touchSprint: boolean;
    contextAction: ContextualAction | null;
    finished: boolean;
  }>({
    player: {
      x: level.playerSpawn.x,
      y: level.playerSpawn.y,
      angle: -Math.PI / 4,
      vx: 0,
      vy: 0,
      speed: 0,
      cargo: 0,
      cargoValue: 0,
      health: 100,
      stamina: stats.maxStamina,
      isHidden: false,
      hideSpotId: null,
      hideLabel: '',
      inTruckId: null,
      interactionRadius: 72,
      walkCycle: 0,
      targetWaypoint: null,
      invulnerableTimer: 0,
    },
    deliveredTimber: 0,
    deliveredValue: 0,
    detection: 0,
    peakAlertStage: 'NONE',
    policeAlertsCount: 0,
    elapsedTime: 0,
    decoyCooldown: 0,
    nextRandomEventTime: 24,
    safeZoneLockedUntil: 0,
    timberPiles: level.timberPiles.map((t) => ({ ...t })),
    hidingSpots: level.hidingSpots.map((h) => ({ ...h })),
    trucks: level.trucks.map((tr) => ({
      ...tr,
      maxSpeed: Math.round(tr.maxSpeed * stats.truckSpeedMultiplier),
      maxCargo: stats.truckMaxCargo,
      condition: stats.truckMaxCondition,
      maxCondition: stats.truckMaxCondition,
    })),
    npcs: level.npcs.map((n) => ({
      ...n,
      waypoints: n.waypoints.map((wp) => ({ ...wp })),
    })),
    checkpoints: level.checkpoints.map((cp) => ({ ...cp })),
    obstacles: level.obstacles.map((ob) => ({ ...ob })),
    particles: [],
    ambientSpores: Array.from({ length: 42 }).map(() => ({
      x: Math.random() * level.mapWidth,
      y: Math.random() * level.mapHeight,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.5) * 14,
      phase: Math.random() * Math.PI * 2,
    })),
    keys: {},
    joystickVec: { x: 0, y: 0 },
    touchSprint: false,
    contextAction: null,
    finished: false,
  });

  const spawnParticles = useCallback(
    (x: number, y: number, color: string, count: number, speedScale = 60) => {
      const w = worldRef.current;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.3 + Math.random() * 0.7) * speedScale;
        w.particles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 3 + Math.random() * 4,
          alpha: 1,
          color,
          life: 0,
          maxLife: 0.45 + Math.random() * 0.4,
        });
      }
    },
    []
  );

  // Trigger Contextual Action (Collect, Hide, Enter/Exit Vehicle, Deliver Cargo, Open Checkpoint)
  const triggerContextAction = useCallback(() => {
    const w = worldRef.current;
    if (w.finished || isPaused) return;
    const act = w.contextAction;
    if (!act) return;

    const p = w.player;
    const activeTruck = p.inTruckId
      ? w.trucks.find((t) => t.id === p.inTruckId) || null
      : null;

    if (act.type === 'COLLECT' && act.targetId) {
      const pile = w.timberPiles.find((t) => t.id === act.targetId);
      if (!pile || pile.amount <= 0) return;

      const currentCargo = activeTruck ? activeTruck.cargo : p.cargo;
      const maxCargo = activeTruck ? activeTruck.maxCargo : stats.maxFootCargo;

      if (currentCargo >= maxCargo) {
        setActiveEventToast({
          id: String(Date.now()),
          title: 'Cargo Full',
          detail: activeTruck
            ? 'Lorry bed is at maximum capacity! Deliver to the Safe Zone.'
            : 'Harness is full! Deliver timber, board a truck, or upgrade capacity.',
          type: 'WARNING',
          timestamp: Date.now(),
        });
        return;
      }

      pile.amount -= 1;
      if (activeTruck) {
        activeTruck.cargo += 1;
      } else {
        p.cargo += 1;
      }
      p.cargoValue += pile.valuePerUnit;
      p.isHidden = false;
      p.hideSpotId = null;
      soundFX.playCollectTimber();
      spawnParticles(pile.x, pile.y, '#b91c1c', 14, 75);
      return;
    }

    if (act.type === 'HIDE' && act.targetId) {
      if (p.inTruckId) return;
      const spot = w.hidingSpots.find((h) => h.id === act.targetId);
      if (!spot) return;
      p.isHidden = true;
      p.hideSpotId = spot.id;
      p.hideLabel = spot.label;
      p.x = spot.x;
      p.y = spot.y;
      p.targetWaypoint = null;
      soundFX.playStealthHide(true);
      spawnParticles(p.x, p.y, '#10b981', 10, 45);
      return;
    }

    if (act.type === 'LEAVE_HIDE') {
      p.isHidden = false;
      p.hideSpotId = null;
      p.hideLabel = '';
      soundFX.playStealthHide(false);
      return;
    }

    if (act.type === 'ENTER_VEHICLE' && act.targetId) {
      const trk = w.trucks.find((t) => t.id === act.targetId);
      if (!trk || trk.condition <= 0) return;
      p.isHidden = false;
      p.hideSpotId = null;
      p.inTruckId = trk.id;
      // Transfer foot cargo into truck
      const spaceLeft = trk.maxCargo - trk.cargo;
      const transfer = Math.min(p.cargo, spaceLeft);
      trk.cargo += transfer;
      p.cargo -= transfer;
      p.x = trk.x;
      p.y = trk.y;
      p.targetWaypoint = null;
      soundFX.playVehicleToggle(true);
      spawnParticles(trk.x, trk.y, '#f59e0b', 12, 55);
      return;
    }

    if (act.type === 'EXIT_VEHICLE') {
      const trk = w.trucks.find((t) => t.id === p.inTruckId);
      if (trk) {
        // Carry as much cargo as foot capacity allows, leave rest in truck
        const take = Math.min(trk.cargo, stats.maxFootCargo - p.cargo);
        p.cargo += take;
        trk.cargo -= take;
        p.x = trk.x + 42;
        p.y = trk.y + 15;
      }
      p.inTruckId = null;
      soundFX.playVehicleToggle(false);
      return;
    }

    if (act.type === 'INTERACT_CHECKPOINT' && act.targetId) {
      const cp = w.checkpoints.find((c) => c.id === act.targetId);
      if (cp) {
        cp.barrierOpen = !cp.barrierOpen;
        soundFX.playClick();
        spawnParticles(cp.x + cp.width / 2, cp.y + cp.height / 2, '#f59e0b', 12, 65);
        setActiveEventToast({
          id: String(Date.now()),
          title: cp.barrierOpen ? 'Checkpost Barrier Raised' : 'Checkpost Barrier Lowered',
          detail: `${cp.name} gate switch toggled.`,
          type: 'INFO',
          timestamp: Date.now(),
        });
      }
      return;
    }

    if (act.type === 'DELIVER') {
      if (w.elapsedTime < w.safeZoneLockedUntil) {
        setActiveEventToast({
          id: String(Date.now()),
          title: 'Safe Zone Under Patrol Sweep!',
          detail: `Wait ${Math.ceil(w.safeZoneLockedUntil - w.elapsedTime)}s for the helicopter spotlight to pass.`,
          type: 'WARNING',
          timestamp: Date.now(),
        });
        return;
      }
      if (w.detection >= 80) {
        setActiveEventToast({
          id: String(Date.now()),
          title: 'Cannot Extract During Active Chase!',
          detail: 'Lose the police or hide until detection drops below 80%.',
          type: 'WARNING',
          timestamp: Date.now(),
        });
        return;
      }

      const carried = activeTruck ? activeTruck.cargo + p.cargo : p.cargo;
      if (carried <= 0) return;

      w.deliveredTimber += carried;
      const batchPay = Math.round(
        (p.cargoValue || carried * 1500) * stats.payoutMultiplier
      );
      w.deliveredValue += batchPay;
      setSessionBonusMoney((prev) => prev + batchPay);

      if (activeTruck) activeTruck.cargo = 0;
      p.cargo = 0;
      p.cargoValue = 0;

      soundFX.playDeliverCargo();
      spawnParticles(level.safeZone.x, level.safeZone.y, '#10b981', 24, 95);

      // Check if mission target reached
      if (w.deliveredTimber >= level.targetTimber) {
        w.finished = true;
        soundFX.playVictory();
        const timeBonus = Math.max(
          0,
          Math.round((level.timeLimitSeconds - w.elapsedTime) * 18)
        );
        const stealthBonus = w.policeAlertsCount === 0 ? 1500 : 0;
        const totalEarned =
          Math.round(level.baseReward * stats.payoutMultiplier) +
          w.deliveredValue +
          timeBonus +
          stealthBonus;

        onMissionComplete({
          levelId: level.id,
          success: true,
          reason: `Delivered ${w.deliveredTimber} prized red timber logs to ${level.safeZone.name}.`,
          cargoDelivered: w.deliveredTimber,
          cargoLost: 0,
          moneyEarned: totalEarned,
          moneyLost: 0,
          timeSeconds: Math.round(w.elapsedTime),
          policeAlerts: w.policeAlertsCount,
          reputationEarned:
            level.reputationReward + (w.policeAlertsCount === 0 ? 5 : 0),
        });
      } else {
        setActiveEventToast({
          id: String(Date.now()),
          title: `Delivered ${carried} Timber Units!`,
          detail: `${level.targetTimber - w.deliveredTimber} more timber units needed to complete the contract.`,
          type: 'OPPORTUNITY',
          timestamp: Date.now(),
        });
      }
    }
  }, [isPaused, level, onMissionComplete, spawnParticles, stats.maxFootCargo, stats.payoutMultiplier]);

  // Drop 1 Cargo Log to shed weight and regain speed
  const handleDropCargo = useCallback(() => {
    const w = worldRef.current;
    if (w.finished || isPaused) return;
    const p = w.player;
    const activeTruck = p.inTruckId
      ? w.trucks.find((t) => t.id === p.inTruckId) || null
      : null;

    if (activeTruck && activeTruck.cargo > 0) {
      activeTruck.cargo -= 1;
      w.timberPiles.push({
        id: `drop-${Date.now()}`,
        x: activeTruck.x - Math.cos(activeTruck.angle) * 45,
        y: activeTruck.y - Math.sin(activeTruck.angle) * 45,
        amount: 1,
        maxAmount: 1,
        valuePerUnit: 1300,
      });
      soundFX.playDropTimber();
      return;
    }

    if (p.cargo > 0) {
      p.cargo -= 1;
      p.cargoValue = Math.max(0, p.cargoValue - 1300);
      w.timberPiles.push({
        id: `drop-${Date.now()}`,
        x: p.x + 20,
        y: p.y + 20,
        amount: 1,
        maxAmount: 1,
        valuePerUnit: 1300,
      });
      soundFX.playDropTimber();
      spawnParticles(p.x, p.y, '#991b1b', 8, 40);
    }
  }, [isPaused, spawnParticles]);

  // Deploy Smoke Decoy to stun nearby rivals/patrols and cut detection
  const handleUseDecoy = useCallback(() => {
    const w = worldRef.current;
    if (w.finished || isPaused || w.decoyCooldown > 0) return;
    const p = w.player;
    w.decoyCooldown = 14;
    w.detection = Math.max(0, w.detection - 35);
    soundFX.playDecoyBlast();
    spawnParticles(p.x, p.y, '#d6d3d1', 28, 110);

    w.npcs.forEach((npc) => {
      const dist = Math.hypot(npc.x - p.x, npc.y - p.y);
      if (dist < 280) {
        npc.stunTimer = 4.5;
        npc.state = 'SUSPICIOUS';
        npc.lastKnownPlayerPos = { x: p.x, y: p.y };
      }
    });

    setActiveEventToast({
      id: String(Date.now()),
      title: 'Smoke Decoy Deployed!',
      detail: 'Nearby patrols and rivals blinded for 4.5 seconds.',
      type: 'INFO',
      timestamp: Date.now(),
    });
  }, [isPaused, spawnParticles]);

  // Keyboard Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      worldRef.current.keys[key] = true;

      if (key === 'escape' || key === 'p') {
        e.preventDefault();
        onPauseToggle();
      } else if (key === 'e' || key === ' ') {
        e.preventDefault();
        triggerContextAction();
      } else if (key === 'q') {
        e.preventDefault();
        handleDropCargo();
      } else if (key === 'f') {
        e.preventDefault();
        handleUseDecoy();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      worldRef.current.keys[key] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleDropCargo, handleUseDecoy, onPauseToggle, triggerContextAction]);

  // Main 60FPS Game Loop & Canvas Renderer
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    let uiSyncAccumulator = 0;

    const triggerRandomEvent = () => {
      const w = worldRef.current;
      const roll = Math.floor(Math.random() * 5);

      if (roll === 0) {
        // Bonus Timber Pile discovered
        const rx = 380 + Math.random() * (level.mapWidth - 760);
        const ry = 320 + Math.random() * (level.mapHeight - 640);
        w.timberPiles.push({
          id: `event-timber-${Date.now()}`,
          x: rx,
          y: ry,
          amount: 2,
          maxAmount: 2,
          valuePerUnit: 1950,
        });
        setActiveEventToast({
          id: String(Date.now()),
          title: '🪵 Fresh Fallen Red Timber Spotted!',
          detail: 'Scouts marked a high-value timber pile on your forest map.',
          type: 'OPPORTUNITY',
          timestamp: Date.now(),
        });
      } else if (roll === 1) {
        // Police Jeep enters sector
        w.npcs.push({
          id: `event-jeep-${Date.now()}`,
          type: 'POLICE_JEEP',
          name: 'Flying Squad Jeep',
          x: 240,
          y: level.mapHeight - 180,
          angle: -0.5,
          speed: 120,
          patrolSpeed: 120,
          chaseSpeed: 178,
          visionRange: 255,
          visionAngle: 0.9,
          state: 'PATROL',
          suspicionTimer: 0,
          waypoints: level.roads[0].points.map((pt) => ({ ...pt })),
          currentWaypointIndex: 0,
          lastKnownPlayerPos: null,
          stunTimer: 0,
        });
        setActiveEventToast({
          id: String(Date.now()),
          title: '🚓 Police Jeep Entered the Area!',
          detail: 'A mobile forest patrol unit is sweeping the main road.',
          type: 'WARNING',
          timestamp: Date.now(),
        });
      } else if (roll === 2) {
        // Rival smuggler appears
        w.npcs.push({
          id: `event-rival-${Date.now()}`,
          type: 'RIVAL_SMUGGLER',
          name: 'Rival Gang Scout',
          x: level.mapWidth * 0.5,
          y: level.mapHeight * 0.65,
          angle: 0,
          speed: 92,
          patrolSpeed: 92,
          chaseSpeed: 145,
          visionRange: 205,
          visionAngle: 1.15,
          state: 'PATROL',
          suspicionTimer: 0,
          waypoints: [
            { x: level.mapWidth * 0.35, y: level.mapHeight * 0.65 },
            { x: level.mapWidth * 0.65, y: level.mapHeight * 0.45 },
          ],
          currentWaypointIndex: 0,
          lastKnownPlayerPos: null,
          stunTimer: 0,
        });
        setActiveEventToast({
          id: String(Date.now()),
          title: '⚔ Rival Gang Scout Appeared!',
          detail: 'Rival smugglers are prowling the central trail for your cargo.',
          type: 'WARNING',
          timestamp: Date.now(),
        });
      } else if (roll === 3) {
        // Hidden shortcut opens (opens checkpoint barriers)
        w.checkpoints.forEach((cp) => {
          cp.barrierOpen = true;
        });
        setActiveEventToast({
          id: String(Date.now()),
          title: '🌿 Village Informant Opened Checkpost Gate!',
          detail: 'Checkpoint barriers have been raised for a fast lorry run.',
          type: 'OPPORTUNITY',
          timestamp: Date.now(),
        });
      } else {
        // Temporary safe zone sweep
        w.safeZoneLockedUntil = w.elapsedTime + 9;
        setActiveEventToast({
          id: String(Date.now()),
          title: '🚨 Safe Route Temporarily Under Sweep!',
          detail: 'Extraction point locked for 9 seconds while patrol passes.',
          type: 'WARNING',
          timestamp: Date.now(),
        });
      }
    };

    const stepSimulation = (dt: number) => {
      const w = worldRef.current;
      if (w.finished || isPaused) return;

      w.elapsedTime += dt;
      if (w.decoyCooldown > 0) {
        w.decoyCooldown = Math.max(0, w.decoyCooldown - dt);
      }
      if (w.player.invulnerableTimer > 0) {
        w.player.invulnerableTimer = Math.max(0, w.player.invulnerableTimer - dt);
      }

      // Check Mission Timer Expiration
      const remaining = level.timeLimitSeconds - w.elapsedTime;
      if (remaining <= 0) {
        w.finished = true;
        soundFX.playDefeat();
        onMissionFailed({
          levelId: level.id,
          success: false,
          reason: 'Dawn broke before you could extract the full timber shipment.',
          cargoDelivered: w.deliveredTimber,
          cargoLost: w.player.cargo,
          moneyEarned: 0,
          moneyLost: Math.min(money, 1200),
          timeSeconds: Math.round(w.elapsedTime),
          policeAlerts: w.policeAlertsCount,
          reputationEarned: 0,
        });
        return;
      }

      // Random Events Trigger
      if (w.elapsedTime >= w.nextRandomEventTime) {
        w.nextRandomEventTime = w.elapsedTime + 28 + Math.random() * 12;
        triggerRandomEvent();
      }

      const p = w.player;
      const activeTruck = p.inTruckId
        ? w.trucks.find((t) => t.id === p.inTruckId) || null
        : null;

      // Read Input Vector (Keyboard + Virtual Joystick + Click-to-Move Waypoint)
      let ix = w.joystickVec.x;
      let iy = w.joystickVec.y;

      if (w.keys['w'] || w.keys['arrowup']) iy -= 1;
      if (w.keys['s'] || w.keys['arrowdown']) iy += 1;
      if (w.keys['a'] || w.keys['arrowleft']) ix -= 1;
      if (w.keys['d'] || w.keys['arrowright']) ix += 1;

      if (ix !== 0 || iy !== 0) {
        p.targetWaypoint = null; // manual input overrides click waypoint
      } else if (p.targetWaypoint && !p.isHidden) {
        const dx = p.targetWaypoint.x - p.x;
        const dy = p.targetWaypoint.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 10) {
          ix = dx / dist;
          iy = dy / dist;
        } else {
          p.targetWaypoint = null;
        }
      }

      const inputMag = Math.hypot(ix, iy);
      if (inputMag > 1) {
        ix /= inputMag;
        iy /= inputMag;
      }

      // Leave hiding automatically if user presses movement significantly
      if (p.isHidden && inputMag > 0.45) {
        p.isHidden = false;
        p.hideSpotId = null;
        p.hideLabel = '';
      }

      const wantsSprint =
        (w.keys['shift'] || w.touchSprint) && inputMag > 0.1 && !activeTruck;

      // Calculate Speed & Stamina
      let currentMaxSpeed = stats.baseMoveSpeed;
      if (activeTruck) {
        currentMaxSpeed = activeTruck.maxSpeed;
      } else {
        // Cargo weight penalty: risk/reward mechanic!
        const weightFactor = Math.max(0.58, 1 - p.cargo * 0.065);
        currentMaxSpeed *= weightFactor;

        if (wantsSprint && p.stamina > 5) {
          currentMaxSpeed *= 1.48;
          p.stamina = Math.max(0, p.stamina - 28 * dt);
        } else {
          p.stamina = Math.min(stats.maxStamina, p.stamina + stats.staminaRegen * dt);
        }
      }

      // Check terrain slowdown (river ford / dense trees)
      let terrainMultiplier = 1;
      for (const ob of w.obstacles) {
        if (
          p.x >= ob.x &&
          p.x <= ob.x + ob.width &&
          p.y >= ob.y &&
          p.y <= ob.y + ob.height
        ) {
          if (ob.slowsPlayer) terrainMultiplier = 0.58;
        }
      }

      if (!p.isHidden && inputMag > 0.05) {
        const moveSpd = currentMaxSpeed * terrainMultiplier * Math.min(1, inputMag);
        const nextX = Math.max(36, Math.min(level.mapWidth - 36, p.x + ix * moveSpd * dt));
        const nextY = Math.max(36, Math.min(level.mapHeight - 36, p.y + iy * moveSpd * dt));

        // Check solid obstacles & closed checkpoint barriers
        let blockedX = false;
        let blockedY = false;
        const pad = activeTruck ? 24 : 14;

        const collidesAt = (tx: number, ty: number) => {
          // Checkpoints with closed barriers block vehicles and slow/block direct passage
          for (const cp of w.checkpoints) {
            if (cp.hasBarrier && !cp.barrierOpen) {
              if (
                tx + pad > cp.x &&
                tx - pad < cp.x + cp.width &&
                ty + pad > cp.y + cp.height * 0.35 &&
                ty - pad < cp.y + cp.height * 0.65
              ) {
                return true;
              }
            }
          }
          for (const ob of w.obstacles) {
            const shouldBlock = activeTruck ? ob.blocksVehicle : ob.blocksPlayer;
            if (!shouldBlock) continue;
            if (
              tx + pad > ob.x &&
              tx - pad < ob.x + ob.width &&
              ty + pad > ob.y &&
              ty - pad < ob.y + ob.height
            ) {
              return true;
            }
          }
          return false;
        };

        if (!collidesAt(nextX, p.y)) p.x = nextX;
        else blockedX = true;

        if (!collidesAt(p.x, nextY)) p.y = nextY;
        else blockedY = true;

        p.angle = Math.atan2(iy, ix);
        p.speed = blockedX && blockedY ? 0 : moveSpd;
        p.walkCycle += dt * (wantsSprint ? 14 : 9);

        if (activeTruck) {
          activeTruck.x = p.x;
          activeTruck.y = p.y;
          activeTruck.angle = p.angle;
          activeTruck.speed = p.speed;
          if (blockedX || blockedY) {
            activeTruck.condition = Math.max(0, activeTruck.condition - 12 * dt);
          }
          // Dust particles behind lorry
          if (Math.random() < 0.35) {
            spawnParticles(
              activeTruck.x - Math.cos(activeTruck.angle) * 32,
              activeTruck.y - Math.sin(activeTruck.angle) * 32,
              '#78716c',
              1,
              25
            );
          }
        }
      } else {
        p.speed = 0;
        if (activeTruck) activeTruck.speed = 0;
      }

      // Update NPCs (Police Officers, Police Jeeps, Rival Smugglers) & Detection System
      let anyPoliceSeeingPlayer = false;
      let highestNPCState: 'PATROL' | 'SUSPICIOUS' | 'CHASE' = 'PATROL';

      // Visibility & noise modifiers
      const cargoCount = activeTruck ? activeTruck.cargo : p.cargo;
      const cargoVisModifier = 1 + cargoCount * 0.04;
      const vehicleVisModifier = activeTruck ? 1.32 : 1.0;
      const nightModifier = level.timeOfDay === 'NIGHT' ? 0.85 : 1.0;

      for (const npc of w.npcs) {
        if (npc.stunTimer > 0) {
          npc.stunTimer = Math.max(0, npc.stunTimer - dt);
          continue;
        }

        const dx = p.x - npc.x;
        const dy = p.y - npc.y;
        const distToPlayer = Math.hypot(dx, dy);
        const angleToPlayer = Math.atan2(dy, dx);

        // Normalize angle difference
        let angleDiff = angleToPlayer - npc.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const effectiveRange =
          npc.visionRange * cargoVisModifier * vehicleVisModifier * nightModifier;

        const inVisionCone =
          !p.isHidden &&
          distToPlayer <= effectiveRange &&
          Math.abs(angleDiff) <= npc.visionAngle * 0.5;

        const inCloseProximity =
          !p.isHidden &&
          distToPlayer <= (activeTruck ? 115 : 68);

        const seesPlayer = inVisionCone || inCloseProximity;

        if (npc.type === 'POLICE_OFFICER' || npc.type === 'POLICE_JEEP') {
          if (seesPlayer) {
            anyPoliceSeeingPlayer = true;
            npc.lastKnownPlayerPos = { x: p.x, y: p.y };
            // Increase global detection faster when closer
            const proximityBoost = Math.max(0.6, 1.5 - distToPlayer / effectiveRange);
            w.detection = Math.min(
              100,
              w.detection + 38 * proximityBoost * stats.detectionRateMultiplier * dt
            );
          }

          // Determine NPC state from global detection & local sight
          if (w.detection >= 75 && (seesPlayer || npc.lastKnownPlayerPos)) {
            if (npc.state !== 'CHASE') {
              npc.state = 'CHASE';
              if (w.peakAlertStage !== 'CHASE') {
                w.peakAlertStage = 'CHASE';
                w.policeAlertsCount += 1;
                soundFX.playChaseSiren();
              }
            }
          } else if (w.detection >= 35 && (seesPlayer || npc.lastKnownPlayerPos)) {
            if (npc.state === 'PATROL') {
              npc.state = 'SUSPICIOUS';
              if (w.peakAlertStage === 'NONE') {
                w.peakAlertStage = 'SUSPICIOUS';
                soundFX.playSuspiciousAlert();
              }
            }
          } else if (w.detection < 20) {
            npc.state = 'PATROL';
            npc.lastKnownPlayerPos = null;
          }

          if (npc.state === 'CHASE') highestNPCState = 'CHASE';
          else if (npc.state === 'SUSPICIOUS' && highestNPCState === 'PATROL') {
            highestNPCState = 'SUSPICIOUS';
          }
        } else if (npc.type === 'RIVAL_SMUGGLER') {
          // Rival Smuggler AI
          if (seesPlayer) {
            npc.lastKnownPlayerPos = { x: p.x, y: p.y };
            npc.suspicionTimer = Math.min(10, npc.suspicionTimer + dt * 2.5);
            if (npc.suspicionTimer >= 1.2) {
              npc.state = 'CHASE';
            } else {
              npc.state = 'SUSPICIOUS';
            }
          } else {
            npc.suspicionTimer = Math.max(0, npc.suspicionTimer - dt * 1.4);
            if (npc.suspicionTimer <= 0) {
              npc.state = 'PATROL';
              npc.lastKnownPlayerPos = null;
            }
          }
        }

        // Move NPC according to its state
        let targetPt: Vector2D | null = null;
        let moveSpeed = npc.patrolSpeed;

        if (npc.state === 'CHASE' && !p.isHidden) {
          targetPt = { x: p.x, y: p.y };
          moveSpeed = npc.chaseSpeed;
        } else if (
          (npc.state === 'SUSPICIOUS' || npc.state === 'CHASE') &&
          npc.lastKnownPlayerPos
        ) {
          targetPt = npc.lastKnownPlayerPos;
          moveSpeed = npc.patrolSpeed * 1.15;
        } else if (npc.waypoints.length > 0) {
          targetPt = npc.waypoints[npc.currentWaypointIndex];
          moveSpeed = npc.patrolSpeed;
        }

        if (targetPt) {
          const tdx = targetPt.x - npc.x;
          const tdy = targetPt.y - npc.y;
          const tdist = Math.hypot(tdx, tdy);
          if (tdist > 8) {
            const targetAngle = Math.atan2(tdy, tdx);
            npc.angle = targetAngle;
            npc.x += (tdx / tdist) * moveSpeed * dt;
            npc.y += (tdy / tdist) * moveSpeed * dt;
          } else {
            if (npc.state === 'PATROL' && npc.waypoints.length > 0) {
              npc.currentWaypointIndex =
                (npc.currentWaypointIndex + 1) % npc.waypoints.length;
            } else if (npc.lastKnownPlayerPos) {
              npc.lastKnownPlayerPos = null;
            }
          }
        }

        // Check Collision with Player
        const catchRadius = activeTruck ? 44 : 28;
        if (!p.isHidden && distToPlayer <= catchRadius) {
          if (npc.type === 'POLICE_OFFICER' || npc.type === 'POLICE_JEEP') {
            if (w.detection >= 55 || npc.state === 'CHASE') {
              // Caught by Police!
              if (activeTruck && activeTruck.condition > 35 && p.invulnerableTimer <= 0) {
                // Truck takes ram damage first
                activeTruck.condition = Math.max(0, activeTruck.condition - 40);
                p.invulnerableTimer = 1.5;
                soundFX.playDamageHit();
                spawnParticles(p.x, p.y, '#ef4444', 18, 90);
              } else if (p.invulnerableTimer <= 0) {
                w.finished = true;
                soundFX.playDefeat();
                const lostCargo = activeTruck
                  ? activeTruck.cargo + p.cargo
                  : p.cargo;
                onMissionFailed({
                  levelId: level.id,
                  success: false,
                  reason: `You were intercepted and arrested by ${npc.name} during the operation.`,
                  cargoDelivered: w.deliveredTimber,
                  cargoLost: lostCargo,
                  moneyEarned: 0,
                  moneyLost: Math.min(money, lostCargo * 600 + 1000),
                  timeSeconds: Math.round(w.elapsedTime),
                  policeAlerts: w.policeAlertsCount,
                  reputationEarned: 0,
                });
                return;
              }
            }
          } else if (npc.type === 'RIVAL_SMUGGLER' && p.invulnerableTimer <= 0) {
            // Rival Smuggler melee hit!
            p.invulnerableTimer = 1.4;
            p.health = Math.max(0, p.health - 25);
            soundFX.playDamageHit();
            spawnParticles(p.x, p.y, '#f97316', 16, 85);

            // Rival knocks 1 timber log loose if player is carrying on foot
            if (!activeTruck && p.cargo > 0) {
              p.cargo -= 1;
              w.timberPiles.push({
                id: `rival-drop-${Date.now()}`,
                x: p.x - 28,
                y: p.y - 28,
                amount: 1,
                maxAmount: 1,
                valuePerUnit: 1400,
              });
              setActiveEventToast({
                id: String(Date.now()),
                title: 'Ambush! Rival Knocked 1 Log Loose!',
                detail: 'Use [F] Smoke Decoy or sprint to escape the rival gang.',
                type: 'WARNING',
                timestamp: Date.now(),
              });
            }

            if (p.health <= 0) {
              w.finished = true;
              soundFX.playDefeat();
              onMissionFailed({
                levelId: level.id,
                success: false,
                reason: `Overpowered by ${npc.name} in rival territory.`,
                cargoDelivered: w.deliveredTimber,
                cargoLost: activeTruck ? activeTruck.cargo + p.cargo : p.cargo,
                moneyEarned: 0,
                moneyLost: Math.min(money, 1500),
                timeSeconds: Math.round(w.elapsedTime),
                policeAlerts: w.policeAlertsCount,
                reputationEarned: 0,
              });
              return;
            }
          }
        }
      }

      // Decay Detection when not seen by any police
      if (!anyPoliceSeeingPlayer && w.detection > 0) {
        const baseDecay = p.isHidden ? 24 * stats.hideDecayMultiplier : 9.5;
        const prevDetection = w.detection;
        w.detection = Math.max(0, w.detection - baseDecay * dt);

        if (prevDetection >= 35 && w.detection < 15 && w.peakAlertStage !== 'NONE') {
          w.peakAlertStage = 'NONE';
          soundFX.playTrailLost();
          setHudAlertBanner({
            text: 'Police lost your trail',
            tone: 'SAFE',
          });
        }
      }

      // Determine Contextual Action near Player
      let nextAction: ContextualAction | null = null;
      const currentTotalCargo = activeTruck
        ? activeTruck.cargo + p.cargo
        : p.cargo;

      // 1. Check Safe Zone Delivery
      const distToSafe = Math.hypot(
        p.x - level.safeZone.x,
        p.y - level.safeZone.y
      );
      if (distToSafe <= level.safeZone.radius + 24 && currentTotalCargo > 0) {
        nextAction = {
          id: 'act-deliver',
          label: `Deliver Cargo (${currentTotalCargo})`,
          keyHint: 'E',
          type: 'DELIVER',
          worldPos: { x: level.safeZone.x, y: level.safeZone.y },
        };
      }

      // 2. If currently hidden, offer Leave Cover
      if (!nextAction && p.isHidden) {
        nextAction = {
          id: 'act-leave-hide',
          label: 'Leave Cover',
          keyHint: 'E',
          type: 'LEAVE_HIDE',
          worldPos: { x: p.x, y: p.y },
        };
      }

      // 3. Check Timber Piles
      if (!nextAction) {
        for (const pile of w.timberPiles) {
          if (pile.amount <= 0) continue;
          const d = Math.hypot(p.x - pile.x, p.y - pile.y);
          if (d <= p.interactionRadius) {
            nextAction = {
              id: `act-collect-${pile.id}`,
              label: 'Collect',
              keyHint: 'E',
              type: 'COLLECT',
              targetId: pile.id,
              worldPos: { x: pile.x, y: pile.y },
            };
            break;
          }
        }
      }

      // 4. Check Hiding Spots (when on foot)
      if (!nextAction && !activeTruck) {
        for (const spot of w.hidingSpots) {
          const d = Math.hypot(p.x - spot.x, p.y - spot.y);
          if (d <= spot.radius + 18) {
            nextAction = {
              id: `act-hide-${spot.id}`,
              label: 'Hide',
              keyHint: 'E',
              type: 'HIDE',
              targetId: spot.id,
              worldPos: { x: spot.x, y: spot.y },
            };
            break;
          }
        }
      }

      // 5. Check Vehicles (Enter or Exit)
      if (!nextAction) {
        if (activeTruck) {
          nextAction = {
            id: 'act-exit-truck',
            label: 'Exit Vehicle',
            keyHint: 'E',
            type: 'EXIT_VEHICLE',
            worldPos: { x: activeTruck.x, y: activeTruck.y },
          };
        } else {
          for (const trk of w.trucks) {
            const d = Math.hypot(p.x - trk.x, p.y - trk.y);
            if (d <= p.interactionRadius + 14) {
              nextAction = {
                id: `act-enter-${trk.id}`,
                label: 'Enter Vehicle',
                keyHint: 'E',
                type: 'ENTER_VEHICLE',
                targetId: trk.id,
                worldPos: { x: trk.x, y: trk.y },
              };
              break;
            }
          }
        }
      }

      // 6. Check Checkpoint Barrier Switch
      if (!nextAction) {
        for (const cp of w.checkpoints) {
          const cx = cp.x + cp.width / 2;
          const cy = cp.y + cp.height / 2;
          if (Math.hypot(p.x - cx, p.y - cy) <= 95) {
            nextAction = {
              id: `act-cp-${cp.id}`,
              label: 'Interact',
              keyHint: 'E',
              type: 'INTERACT_CHECKPOINT',
              targetId: cp.id,
              worldPos: { x: cx, y: cy },
            };
            break;
          }
        }
      }

      w.contextAction = nextAction;

      // Update Particles & Ambient Spores
      for (let i = w.particles.length - 1; i >= 0; i--) {
        const pt = w.particles[i];
        pt.life += dt;
        if (pt.life >= pt.maxLife) {
          w.particles.splice(i, 1);
          continue;
        }
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.alpha = 1 - pt.life / pt.maxLife;
      }

      for (const sp of w.ambientSpores) {
        sp.x = (sp.x + sp.vx * dt + level.mapWidth) % level.mapWidth;
        sp.y = (sp.y + sp.vy * dt + level.mapHeight) % level.mapHeight;
        sp.phase += dt * 2.2;
      }

      // Periodically sync HUD state (every ~80ms)
      uiSyncAccumulator += dt;
      if (uiSyncAccumulator >= 0.08) {
        uiSyncAccumulator = 0;
        setHudCargo(activeTruck ? activeTruck.cargo + p.cargo : p.cargo);
        setHudMaxCargo(activeTruck ? activeTruck.maxCargo : stats.maxFootCargo);
        setHudDelivered(w.deliveredTimber);
        setHudHealth(Math.round(p.health));
        setHudStamina(Math.round(p.stamina));
        setHudDetection(Math.round(w.detection));
        setHudIsHidden(p.isHidden);
        setHudHideLabel(p.hideLabel);
        setHudTimeRemaining(Math.max(0, Math.ceil(level.timeLimitSeconds - w.elapsedTime)));
        setHudContextAction(w.contextAction);
        setHudDecoyCooldown(w.decoyCooldown);

        if (activeTruck) {
          setHudVehicle({
            name: activeTruck.name,
            speedKmh: Math.round((activeTruck.speed / 260) * 85),
            cargo: activeTruck.cargo + p.cargo,
            maxCargo: activeTruck.maxCargo,
            condition: Math.round(activeTruck.condition),
            maxCondition: activeTruck.maxCondition,
          });
        } else {
          setHudVehicle(null);
        }

        // Update Police Alert Status Banner
        if (w.detection >= 80 || highestNPCState === 'CHASE') {
          setHudAlertBanner({
            text: '🚨 Police alerted · CHASE IN PROGRESS',
            tone: 'CHASE',
          });
        } else if (w.detection >= 40 || highestNPCState === 'SUSPICIOUS') {
          setHudAlertBanner({
            text: '⚠ Suspicious activity detected',
            tone: 'SUSPICIOUS',
          });
        } else if (w.detection > 5) {
          setHudAlertBanner({
            text: p.isHidden ? 'Hiding — Patrol searching area' : 'Low profile — Stay out of sight',
            tone: 'NORMAL',
          });
        }
      }
    };

    const renderWorld = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = worldRef.current;
      const p = w.player;

      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      const cw = canvas.width;
      const ch = canvas.height;

      ctx.save();

      // Calculate Camera Transform
      let zoom = settings.cameraOverview
        ? Math.min(cw / level.mapWidth, ch / level.mapHeight) * 0.94
        : Math.min(1.08, Math.max(0.78, cw / 1380));

      const viewW = cw / zoom;
      const viewH = ch / zoom;

      let camX = p.x - viewW / 2;
      let camY = p.y - viewH / 2;

      if (settings.cameraOverview) {
        camX = (level.mapWidth - viewW) / 2;
        camY = (level.mapHeight - viewH) / 2;
      } else {
        camX = Math.max(0, Math.min(level.mapWidth - viewW, camX));
        camY = Math.max(0, Math.min(level.mapHeight - viewH, camY));
      }

      // Base Forest Floor
      ctx.fillStyle =
        level.timeOfDay === 'NIGHT'
          ? '#06100a'
          : level.timeOfDay === 'DUSK'
          ? '#0d1b11'
          : '#0a180f';
      ctx.fillRect(0, 0, cw, ch);

      ctx.scale(zoom, zoom);
      ctx.translate(-camX, -camY);

      // Subtle Topographic Grid / Forest Floor Texture
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= level.mapWidth; gx += 120) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, level.mapHeight);
        ctx.stroke();
      }
      for (let gy = 0; gy <= level.mapHeight; gy += 120) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(level.mapWidth, gy);
        ctx.stroke();
      }

      // Render Roads & Trails
      for (const road of level.roads) {
        if (road.points.length < 2) continue;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (road.type === 'MAIN_ROAD') {
          // Outer mud shoulder
          ctx.strokeStyle = '#2b1e16';
          ctx.lineWidth = road.width + 14;
          ctx.beginPath();
          road.points.forEach((pt, idx) =>
            idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)
          );
          ctx.stroke();

          // Inner compacted earth road
          ctx.strokeStyle = '#3d2b1f';
          ctx.lineWidth = road.width;
          ctx.stroke();

          // Tire tracks dashed center
          ctx.strokeStyle = 'rgba(20, 14, 10, 0.35)';
          ctx.lineWidth = 4;
          ctx.setLineDash([18, 18]);
          ctx.stroke();
        } else if (road.type === 'DIRT_TRAIL') {
          ctx.strokeStyle = '#291d15';
          ctx.lineWidth = road.width;
          ctx.beginPath();
          road.points.forEach((pt, idx) =>
            idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)
          );
          ctx.stroke();
        }
        ctx.restore();
      }

      // Render Obstacles (River, Rocks, Village Huts, Dense Trees)
      for (const ob of w.obstacles) {
        ctx.save();
        if (ob.type === 'RIVER') {
          ctx.fillStyle = '#0c2d3a';
          ctx.fillRect(ob.x, ob.y, ob.width, ob.height);
          // River bank border
          ctx.strokeStyle = '#164e63';
          ctx.lineWidth = 3;
          ctx.strokeRect(ob.x, ob.y, ob.width, ob.height);
          // Animated water ripples
          ctx.strokeStyle = 'rgba(103, 232, 249, 0.22)';
          ctx.lineWidth = 2;
          const offset = (w.elapsedTime * 28) % 60;
          for (let rx = ob.x + offset; rx < ob.x + ob.width - 20; rx += 60) {
            ctx.beginPath();
            ctx.moveTo(rx, ob.y + 22);
            ctx.lineTo(rx + 24, ob.y + 22);
            ctx.moveTo(rx - 15, ob.y + ob.height - 22);
            ctx.lineTo(rx + 12, ob.y + ob.height - 22);
            ctx.stroke();
          }
        } else if (ob.type === 'VILLAGE_HUT') {
          // Thatch / terracotta forest village hut
          ctx.fillStyle = '#451a03';
          ctx.fillRect(ob.x, ob.y, ob.width, ob.height);
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 3;
          ctx.strokeRect(ob.x, ob.y, ob.width, ob.height);
          // Roof ridge line
          ctx.beginPath();
          ctx.moveTo(ob.x, ob.y + ob.height / 2);
          ctx.lineTo(ob.x + ob.width, ob.y + ob.height / 2);
          ctx.stroke();
          // Warm lantern glow outside hut
          ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
          ctx.beginPath();
          ctx.arc(ob.x + ob.width / 2, ob.y + ob.height + 8, 22, 0, Math.PI * 2);
          ctx.fill();
        } else if (ob.type === 'ROCK_WALL') {
          ctx.fillStyle = '#292524';
          ctx.beginPath();
          ctx.roundRect(ob.x, ob.y, ob.width, ob.height, 18);
          ctx.fill();
          ctx.strokeStyle = '#44403c';
          ctx.lineWidth = 3;
          ctx.stroke();
        } else if (ob.type === 'DENSE_TREES') {
          ctx.fillStyle = '#052e16';
          ctx.beginPath();
          ctx.roundRect(ob.x, ob.y, ob.width, ob.height, 24);
          ctx.fill();
          ctx.strokeStyle = '#14532d';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Render Bridges over River
      for (const road of level.roads) {
        if (road.type !== 'BRIDGE' || road.points.length < 2) continue;
        const p0 = road.points[0];
        const p1 = road.points[1];
        ctx.save();
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = road.width;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();

        // Wooden planks
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 10]);
        ctx.stroke();
        ctx.restore();
      }

      // Render Police Checkpoints
      for (const cp of w.checkpoints) {
        ctx.save();
        ctx.fillStyle = 'rgba(30, 41, 59, 0.55)';
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.45)';
        ctx.lineWidth = 2;
        ctx.fillRect(cp.x, cp.y, cp.width, cp.height);
        ctx.strokeRect(cp.x, cp.y, cp.width, cp.height);

        // Guard booth on left side
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(cp.x + 6, cp.y + 8, 34, 34);
        ctx.strokeStyle = '#64748b';
        ctx.strokeRect(cp.x + 6, cp.y + 8, 34, 34);

        // Red/White Barrier Gate
        if (cp.hasBarrier) {
          ctx.strokeStyle = cp.barrierOpen ? '#10b981' : '#ef4444';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.moveTo(cp.x + 40, cp.y + cp.height / 2);
          if (cp.barrierOpen) {
            ctx.lineTo(cp.x + 65, cp.y + 12);
          } else {
            ctx.lineTo(cp.x + cp.width - 10, cp.y + cp.height / 2);
          }
          ctx.stroke();
        }

        ctx.fillStyle = '#fca5a5';
        ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cp.name, cp.x + cp.width / 2, cp.y - 8);
        ctx.restore();
      }

      // Render Safe Zone / Extraction Point
      const sz = level.safeZone;
      const isSweepLocked = w.elapsedTime < w.safeZoneLockedUntil;
      ctx.save();
      const pulse = 1 + Math.sin(w.elapsedTime * 3.5) * 0.06;
      ctx.beginPath();
      ctx.arc(sz.x, sz.y, sz.radius * pulse, 0, Math.PI * 2);
      ctx.fillStyle = isSweepLocked
        ? 'rgba(239, 68, 68, 0.16)'
        : 'rgba(16, 185, 129, 0.16)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = isSweepLocked ? '#ef4444' : '#10b981';
      ctx.setLineDash([12, 8]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Safe zone inner depot platform
      ctx.fillStyle = '#064e3b';
      ctx.beginPath();
      ctx.arc(sz.x, sz.y, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ecfdf5';
      ctx.font = '700 12px "Cinzel", serif';
      ctx.textAlign = 'center';
      ctx.fillText('SAFE EXTRACTION ZONE', sz.x, sz.y - sz.radius - 14);
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#6ee7b7';
      ctx.fillText(
        `Delivered: ${w.deliveredTimber} / ${level.targetTimber}`,
        sz.x,
        sz.y + 4
      );
      ctx.restore();

      // Render Hiding Spots
      for (const spot of w.hidingSpots) {
        const playerInside = p.isHidden && p.hideSpotId === spot.id;
        ctx.save();
        ctx.beginPath();
        ctx.arc(spot.x, spot.y, spot.radius, 0, Math.PI * 2);
        ctx.fillStyle = playerInside
          ? 'rgba(16, 185, 129, 0.28)'
          : 'rgba(20, 83, 45, 0.45)';
        ctx.fill();
        ctx.lineWidth = playerInside ? 2.5 : 1.5;
        ctx.strokeStyle = playerInside
          ? '#34d399'
          : 'rgba(74, 222, 128, 0.35)';
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Stylized foliage/hut icon inside hiding zone
        ctx.fillStyle = '#14532d';
        ctx.beginPath();
        ctx.arc(spot.x - 14, spot.y - 8, 18, 0, Math.PI * 2);
        ctx.arc(spot.x + 14, spot.y - 6, 16, 0, Math.PI * 2);
        ctx.arc(spot.x, spot.y + 10, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(214, 211, 209, 0.85)';
        ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(spot.label, spot.x, spot.y + spot.radius + 14);
        ctx.restore();
      }

      // Render Red Sandalwood Timber Piles
      for (const pile of w.timberPiles) {
        if (pile.amount <= 0) continue;
        ctx.save();
        // Subtle crimson glow
        ctx.beginPath();
        ctx.arc(pile.x, pile.y, 30, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(185, 28, 28, 0.22)';
        ctx.fill();

        // Draw stacked red sandalwood logs
        for (let i = 0; i < Math.min(pile.amount, 4); i++) {
          const offsetY = (i - 1) * 7;
          ctx.fillStyle = '#7f1d1d';
          ctx.strokeStyle = '#f87171';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(pile.x - 18, pile.y + offsetY - 4, 36, 8, 4);
          ctx.fill();
          ctx.stroke();
        }

        // Count label
        ctx.fillStyle = '#fef2f2';
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`🪵 x${pile.amount}`, pile.x, pile.y - 22);
        ctx.restore();
      }

      // Render Forest Tree Clusters (Swaying Canopy)
      const swayX = Math.sin(w.elapsedTime * 1.6) * 3;
      for (const cluster of level.treeClusters) {
        ctx.save();
        for (let i = 0; i < cluster.density; i++) {
          const angle = (i / cluster.density) * Math.PI * 2 + cluster.x;
          const dist = ((i * 29) % cluster.radius) * 0.85;
          const tx = cluster.x + Math.cos(angle) * dist + swayX;
          const ty = cluster.y + Math.sin(angle) * dist;
          ctx.fillStyle = i % 2 === 0 ? '#062c17' : '#0a3a1e';
          ctx.beginPath();
          ctx.arc(tx, ty, 22 + (i % 8), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.14)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Render Cargo Trucks
      for (const trk of w.trucks) {
        ctx.save();
        ctx.translate(trk.x, trk.y);
        ctx.rotate(trk.angle);

        // Headlight beams
        ctx.fillStyle =
          level.timeOfDay === 'NIGHT'
            ? 'rgba(253, 224, 71, 0.26)'
            : 'rgba(253, 224, 71, 0.1)';
        ctx.beginPath();
        ctx.moveTo(26, -10);
        ctx.lineTo(150, -52);
        ctx.lineTo(150, 52);
        ctx.lineTo(26, 10);
        ctx.closePath();
        ctx.fill();

        // Truck chassis shadow
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(-30, -18, 60, 38);

        // Cargo bed
        ctx.fillStyle = '#451a03';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;
        ctx.fillRect(-28, -16, 38, 32);
        ctx.strokeRect(-28, -16, 38, 32);

        // Red logs stacked in truck bed
        const visibleLogs = Math.min(5, trk.cargo + (p.inTruckId === trk.id ? p.cargo : 0));
        for (let i = 0; i < visibleLogs; i++) {
          ctx.fillStyle = '#991b1b';
          ctx.fillRect(-24, -12 + i * 5, 30, 4);
        }

        // Truck Cab
        ctx.fillStyle = '#b45309';
        ctx.fillRect(10, -14, 18, 28);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(20, -11, 6, 22); // windshield

        ctx.restore();

        // Truck Label when player is not inside
        if (p.inTruckId !== trk.id) {
          ctx.save();
          ctx.fillStyle = '#fde68a';
          ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${trk.name} (${trk.cargo}/${trk.maxCargo})`, trk.x, trk.y - 26);
          ctx.restore();
        }
      }

      // Render NPCs (Police Officers, Police Jeeps, Rival Smugglers) + Vision Cones
      for (const npc of w.npcs) {
        ctx.save();

        // Vision Cone
        const cargoCount = p.inTruckId ? 4 : p.cargo;
        const effectiveRange =
          npc.visionRange *
          (1 + cargoCount * 0.04) *
          (p.inTruckId ? 1.32 : 1.0) *
          (level.timeOfDay === 'NIGHT' ? 0.85 : 1.0);

        ctx.beginPath();
        ctx.moveTo(npc.x, npc.y);
        ctx.arc(
          npc.x,
          npc.y,
          effectiveRange,
          npc.angle - npc.visionAngle / 2,
          npc.angle + npc.visionAngle / 2
        );
        ctx.closePath();

        if (npc.stunTimer > 0) {
          ctx.fillStyle = 'rgba(168, 162, 158, 0.12)';
        } else if (npc.state === 'CHASE') {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
        } else if (npc.state === 'SUSPICIOUS') {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.24)';
        } else if (npc.type === 'RIVAL_SMUGGLER') {
          ctx.fillStyle = 'rgba(249, 115, 22, 0.16)';
        } else {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        }
        ctx.fill();

        // Draw NPC Body
        ctx.translate(npc.x, npc.y);
        ctx.rotate(npc.angle);

        if (npc.type === 'POLICE_JEEP') {
          // Police Jeep Body
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2;
          ctx.fillRect(-22, -13, 44, 26);
          ctx.strokeRect(-22, -13, 44, 26);

          // Flashing Red/Blue Siren Bar on roof
          const flash = Math.floor(w.elapsedTime * 8) % 2 === 0;
          ctx.fillStyle = flash ? '#ef4444' : '#3b82f6';
          ctx.fillRect(-4, -10, 6, 10);
          ctx.fillStyle = flash ? '#3b82f6' : '#ef4444';
          ctx.fillRect(-4, 0, 6, 10);
        } else if (npc.type === 'POLICE_OFFICER') {
          // Khaki Police Officer
          ctx.fillStyle = '#a16207';
          ctx.beginPath();
          ctx.arc(0, 0, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // Rival Smuggler
          ctx.fillStyle = '#7c2d12';
          ctx.beginPath();
          ctx.arc(0, 0, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fb923c';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();

        // NPC Status Tag
        ctx.save();
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        if (npc.stunTimer > 0) {
          ctx.fillStyle = '#e7e5e4';
          ctx.fillText('STUNNED', npc.x, npc.y - 20);
        } else if (npc.state === 'CHASE') {
          ctx.fillStyle = '#f87171';
          ctx.fillText('🚨 CHASE!', npc.x, npc.y - 20);
        } else if (npc.state === 'SUSPICIOUS') {
          ctx.fillStyle = '#fbbf24';
          ctx.fillText('⚠ SUSPICIOUS', npc.x, npc.y - 20);
        }
        ctx.restore();
      }

      // Click-to-Move Waypoint Marker
      if (p.targetWaypoint && !p.isHidden) {
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.targetWaypoint.x, p.targetWaypoint.y, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Render Player Interaction Radius & Character (when not inside a truck)
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.interactionRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.24)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      if (!p.inTruckId) {
        ctx.save();
        ctx.translate(p.x, p.y);

        if (p.isHidden) {
          ctx.globalAlpha = 0.45;
        }

        ctx.rotate(p.angle);

        // Carried Red Timber Logs strapped on Player's Back
        for (let i = 0; i < Math.min(p.cargo, 5); i++) {
          ctx.fillStyle = '#991b1b';
          ctx.strokeStyle = '#fca5a5';
          ctx.lineWidth = 1;
          ctx.fillRect(-16 - i * 3, -11, 8, 22);
          ctx.strokeRect(-16 - i * 3, -11, 8, 22);
        }

        // Player Shoulders (Olive Field Jacket)
        ctx.fillStyle = '#14532d';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-10, -14, 20, 28, 8);
        ctx.fill();
        ctx.stroke();

        // Signature Crimson Scarf & Head
        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        ctx.arc(-2, 0, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#292524';
        ctx.beginPath();
        ctx.arc(2, 0, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // Render Particles & Drifting Spores
      for (const pt of w.particles) {
        ctx.save();
        ctx.globalAlpha = pt.alpha;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const sp of w.ambientSpores) {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(sp.phase) * 0.2;
        ctx.fillStyle = level.timeOfDay === 'NIGHT' ? '#fde047' : '#a7f3d0';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Nighttime / Storm Atmospheric Lighting Overlay
      if (level.timeOfDay === 'NIGHT' || level.timeOfDay === 'STORM') {
        ctx.save();
        const grad = ctx.createRadialGradient(p.x, p.y, 70, p.x, p.y, 380);
        grad.addColorStop(0, 'rgba(4, 10, 7, 0.05)');
        grad.addColorStop(1, 'rgba(3, 8, 5, 0.72)');
        ctx.fillStyle = grad;
        ctx.fillRect(camX, camY, viewW, viewH);
        ctx.restore();
      }

      // Floating Contextual World Prompt above Interactable Object
      if (w.contextAction && w.contextAction.worldPos) {
        const wp = w.contextAction.worldPos;
        ctx.save();
        const labelText = `[${w.contextAction.keyHint}] ${w.contextAction.label}`;
        ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
        const textWidth = ctx.measureText(labelText).width;
        const boxW = textWidth + 24;
        const boxH = 28;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
        ctx.beginPath();
        ctx.roundRect(wp.x - boxW / 2, wp.y - 54, boxW, boxH, 8);
        ctx.fill();

        ctx.fillStyle = '#090d0a';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, wp.x, wp.y - 36);
        ctx.restore();
      }

      ctx.restore();
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      stepSimulation(dt);
      renderWorld();
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    isPaused,
    level,
    money,
    onMissionComplete,
    onMissionFailed,
    settings.cameraOverview,
    spawnParticles,
    stats.baseMoveSpeed,
    stats.detectionRateMultiplier,
    stats.hideDecayMultiplier,
    stats.maxFootCargo,
    stats.maxStamina,
    stats.payoutMultiplier,
    stats.staminaRegen,
  ]);

  // Handle Mouse Click on Canvas (Interact if clicking near contextual object, else move waypoint)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || isPaused) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const w = worldRef.current;
    const p = w.player;
    const cw = canvas.width;
    const ch = canvas.height;

    const zoom = settings.cameraOverview
      ? Math.min(cw / level.mapWidth, ch / level.mapHeight) * 0.94
      : Math.min(1.08, Math.max(0.78, cw / 1380));

    const viewW = cw / zoom;
    const viewH = ch / zoom;

    let camX = p.x - viewW / 2;
    let camY = p.y - viewH / 2;
    if (settings.cameraOverview) {
      camX = (level.mapWidth - viewW) / 2;
      camY = (level.mapHeight - viewH) / 2;
    } else {
      camX = Math.max(0, Math.min(level.mapWidth - viewW, camX));
      camY = Math.max(0, Math.min(level.mapHeight - viewH, camY));
    }

    const worldX = camX + clickX / zoom;
    const worldY = camY + clickY / zoom;

    // If clicking near an active contextual prompt, trigger it directly!
    if (w.contextAction && w.contextAction.worldPos) {
      const distToAct = Math.hypot(
        worldX - w.contextAction.worldPos.x,
        worldY - w.contextAction.worldPos.y
      );
      if (distToAct <= 85) {
        triggerContextAction();
        return;
      }
    }

    p.isHidden = false;
    p.hideSpotId = null;
    p.targetWaypoint = {
      x: Math.max(40, Math.min(level.mapWidth - 40, worldX)),
      y: Math.max(40, Math.min(level.mapHeight - 40, worldY)),
    };
  };

  // Compute Detection Block Bar string (e.g. ████████░░ 80%)
  const filledBlocks = Math.round(hudDetection / 10);
  const detectionAsciiBar =
    '█'.repeat(Math.min(10, Math.max(0, filledBlocks))) +
    '░'.repeat(Math.max(0, 10 - filledBlocks));

  // Compute Dynamic Objective Text
  let dynamicObjective = level.objectiveText;
  if (hudDetection >= 80) {
    dynamicObjective = 'Escape the police or hide in dense cover until detection drops!';
  } else if (hudDelivered + hudCargo >= level.targetTimber && hudCargo > 0) {
    dynamicObjective = `Reach the ${level.safeZone.name} in the north and deliver your cargo.`;
  }

  const showTouchControls =
    settings.touchControlsMode === 'ALWAYS' ||
    (settings.touchControlsMode === 'AUTO' &&
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || window.innerWidth < 900));

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#08120c] select-none">
      {/* Interactive Top-Down Game Map Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="h-full w-full block cursor-crosshair game-touch-surface"
      />

      {/* TOP HUD */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 p-3 sm:p-4 flex flex-wrap items-start justify-between gap-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent">
        {/* Top-Left: Current Mission & Level */}
        <div className="pointer-events-auto rounded-xl border border-white/15 bg-[#0a160f]/85 backdrop-blur-md px-4 py-2.5 shadow-lg">
          <div className="text-xs text-amber-400 font-semibold">
            {level.code} · LEVEL {level.id}
          </div>
          <div className="font-display text-sm sm:text-base font-bold text-white whitespace-nowrap">
            {level.title}
          </div>
        </div>

        {/* Top-Center: Money, Cargo, Health, Reputation, Mission Timer */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-4 sm:gap-6 rounded-xl border border-white/15 bg-[#0a160f]/85 backdrop-blur-md px-4 sm:px-5 py-2.5 shadow-lg font-mono text-xs sm:text-sm tabular-nums">
          <div title="Total Syndicate Money">
            <span className="text-stone-400 mr-1">💰</span>
            <span className="font-bold text-amber-400">
              {formatRupees(money + sessionBonusMoney)}
            </span>
          </div>

          <div title="Timber Cargo Carried vs Capacity">
            <span className="text-stone-400 mr-1">🪵 Cargo:</span>
            <span
              className={`font-bold ${
                hudCargo >= hudMaxCargo ? 'text-amber-400' : 'text-white'
              }`}
            >
              {hudCargo} / {hudMaxCargo}
            </span>
          </div>

          <div title="Smuggler Health">
            <span className="text-stone-400 mr-1">❤️</span>
            <span
              className={`font-bold ${
                hudHealth <= 35 ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {hudHealth}%
            </span>
          </div>

          <div className="hidden sm:block" title="Syndicate Reputation">
            <span className="text-stone-400 mr-1">⭐</span>
            <span className="font-bold text-white">{reputation}</span>
          </div>

          <div title="Mission Timer">
            <span className="text-stone-400 mr-1">⏱</span>
            <span
              className={`font-bold ${
                hudTimeRemaining <= 45 ? 'text-red-400' : 'text-stone-100'
              }`}
            >
              {formatTimeMMSS(hudTimeRemaining)}
            </span>
          </div>
        </div>

        {/* Top-Right: Pause & Settings Buttons */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onPauseToggle}
            className="px-3.5 py-2.5 rounded-xl border border-white/15 bg-[#0a160f]/85 hover:bg-white/15 text-xs font-semibold text-white backdrop-blur-md transition-colors whitespace-nowrap"
          >
            Pause
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="px-3.5 py-2.5 rounded-xl border border-white/15 bg-[#0a160f]/85 hover:bg-white/15 text-xs font-semibold text-stone-200 backdrop-blur-md transition-colors whitespace-nowrap"
          >
            Settings
          </button>
        </div>
      </div>

      {/* STEALTH, DETECTION METER & VEHICLE HUD (Top-Left below mission card) */}
      <div className="pointer-events-none fixed left-3 sm:left-4 top-20 z-20 flex flex-col gap-2.5 max-w-xs">
        {/* Detection Meter Card */}
        <div className="rounded-xl border border-white/15 bg-[#0a160f]/85 backdrop-blur-md px-4 py-3 shadow-lg space-y-1.5">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="font-bold tracking-wider text-stone-300">
              DETECTION
            </span>
            {hudIsHidden && (
              <span className="font-mono font-bold text-emerald-400">
                HIDING ({hudHideLabel || 'Cover'})
              </span>
            )}
          </div>

          <div className="font-mono text-sm font-bold tracking-widest tabular-nums flex items-center justify-between gap-3">
            <span
              className={
                hudDetection >= 80
                  ? 'text-red-500'
                  : hudDetection >= 40
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }
            >
              {detectionAsciiBar}
            </span>
            <span className="text-white">{hudDetection}%</span>
          </div>

          <div
            className={`text-xs font-medium ${
              hudAlertBanner.tone === 'CHASE'
                ? 'text-red-400 font-semibold'
                : hudAlertBanner.tone === 'SUSPICIOUS'
                ? 'text-amber-300'
                : hudAlertBanner.tone === 'SAFE'
                ? 'text-emerald-300'
                : 'text-stone-400'
            }`}
          >
            {hudAlertBanner.text}
          </div>
        </div>

        {/* Vehicle HUD (Visible when inside Cargo Truck) */}
        {hudVehicle && (
          <div className="rounded-xl border border-amber-500/40 bg-[#141109]/90 backdrop-blur-md px-4 py-3 shadow-lg space-y-1.5 font-mono text-xs tabular-nums">
            <div className="font-sans font-bold text-amber-400">
              🚚 {hudVehicle.name}
            </div>
            <div className="flex items-center justify-between text-stone-300">
              <span>Speed: {hudVehicle.speedKmh} km/h</span>
              <span>
                Cargo: {hudVehicle.cargo}/{hudVehicle.maxCargo}
              </span>
            </div>
            <div className="flex items-center justify-between text-stone-300">
              <span>Condition:</span>
              <span
                className={
                  hudVehicle.condition <= 35
                    ? 'text-red-400 font-bold'
                    : 'text-emerald-400 font-bold'
                }
              >
                {hudVehicle.condition}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* RANDOM EVENT NOTIFICATION BANNER */}
      {activeEventToast &&
        Date.now() - activeEventToast.timestamp < 5500 && (
          <div className="pointer-events-none fixed inset-x-0 top-20 z-30 flex justify-center px-4">
            <div className="rounded-xl border border-amber-400/40 bg-[#0d1b12]/95 backdrop-blur-md px-5 py-3 shadow-2xl max-w-md text-center space-y-0.5">
              <div className="text-xs font-bold text-amber-400">
                {activeEventToast.title}
              </div>
              <div className="text-xs text-stone-200">
                {activeEventToast.detail}
              </div>
            </div>
          </div>
        )}

      {/* TACTICAL FOREST MINI-MAP (Top-Right below Pause/Settings) */}
      {settings.showMiniMap && (
        <div className="pointer-events-none hidden md:block fixed right-4 top-20 z-20 rounded-xl border border-white/15 bg-[#07120b]/85 backdrop-blur-md p-2.5 shadow-lg">
          <div className="text-[10px] font-mono text-stone-400 mb-1 flex items-center justify-between">
            <span>SECTOR RADAR</span>
            <span className="text-emerald-400">N ▲</span>
          </div>
          <div className="relative w-40 h-28 bg-[#0b1d12] rounded border border-white/10 overflow-hidden">
            {/* Safe Zone Blip */}
            <div
              style={{
                left: `${(level.safeZone.x / level.mapWidth) * 100}%`,
                top: `${(level.safeZone.y / level.mapHeight) * 100}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-emerald-400/40 border border-emerald-400"
              title="Safe Zone"
            />
            {/* Timber Blips */}
            {worldRef.current.timberPiles
              .filter((t) => t.amount > 0)
              .map((t) => (
                <div
                  key={t.id}
                  style={{
                    left: `${(t.x / level.mapWidth) * 100}%`,
                    top: `${(t.y / level.mapHeight) * 100}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500"
                />
              ))}
            {/* NPC Blips */}
            {worldRef.current.npcs.map((n) => (
              <div
                key={n.id}
                style={{
                  left: `${(n.x / level.mapWidth) * 100}%`,
                  top: `${(n.y / level.mapHeight) * 100}%`,
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${
                  n.type === 'RIVAL_SMUGGLER' ? 'bg-orange-400' : 'bg-sky-400'
                }`}
              />
            ))}
            {/* Player Blip */}
            <div
              style={{
                left: `${(worldRef.current.player.x / level.mapWidth) * 100}%`,
                top: `${(worldRef.current.player.y / level.mapHeight) * 100}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white"
            />
          </div>
        </div>
      )}

      {/* MOBILE / TOUCH CONTROLS */}
      {showTouchControls && (
        <TouchControls
          onMoveVector={(vec) => {
            worldRef.current.joystickVec = vec;
          }}
          onSprintChange={(sprinting) => {
            worldRef.current.touchSprint = sprinting;
          }}
          onTriggerContextAction={triggerContextAction}
          onDropCargo={handleDropCargo}
          onUseDecoy={handleUseDecoy}
          contextAction={hudContextAction}
          hasCargo={hudCargo > 0}
          decoyCooldown={hudDecoyCooldown}
        />
      )}

      {/* BOTTOM AREA: MISSION OBJECTIVE PANEL & AVAILABLE ACTIONS */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
        {/* Mission Objective Panel */}
        <div className="pointer-events-auto rounded-xl border border-white/15 bg-[#0a160f]/90 backdrop-blur-md px-4 py-3 shadow-lg max-w-xl flex-1 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono tabular-nums">
            <span className="text-amber-400 font-bold">{level.code}</span>
            <span className="text-emerald-400 font-bold">
              Progress: 🪵 {hudDelivered} / {level.targetTimber} Delivered
              {hudCargo > 0 ? ` (+${hudCargo} Carried)` : ''}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-100 font-medium">
            &ldquo;{dynamicObjective}&rdquo;
          </p>
        </div>

        {/* Available Actions Bar */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-white/15 bg-[#0a160f]/90 backdrop-blur-md px-3.5 py-2.5 shadow-lg">
          {hudContextAction ? (
            <button
              type="button"
              onClick={triggerContextAction}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap shadow"
            >
              [{hudContextAction.keyHint}] {hudContextAction.label}
            </button>
          ) : (
            <span className="text-xs text-stone-400 px-2 whitespace-nowrap">
              Approach timber, cover, or lorry to interact
            </span>
          )}

          {hudCargo > 0 && (
            <button
              type="button"
              onClick={handleDropCargo}
              className="px-3 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-stone-200 transition-colors whitespace-nowrap"
            >
              [Q] Drop Cargo
            </button>
          )}

          <button
            type="button"
            disabled={hudDecoyCooldown > 0}
            onClick={handleUseDecoy}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
              hudDecoyCooldown > 0
                ? 'border-white/10 bg-white/5 text-stone-500 cursor-not-allowed'
                : 'border-red-500/40 bg-red-950/70 hover:bg-red-900/80 text-red-200'
            }`}
          >
            {hudDecoyCooldown > 0
              ? `[F] Smoke (${Math.ceil(hudDecoyCooldown)}s)`
              : '[F] Smoke Decoy'}
          </button>

          <div
            className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-white/10 text-xs font-mono text-stone-300 tabular-nums"
            title="Sprint Stamina"
          >
            <span>⚡ Stamina:</span>
            <span className="text-emerald-400 font-bold">{hudStamina}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
