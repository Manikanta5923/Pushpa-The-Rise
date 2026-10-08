import React, { useState } from 'react';
import {
  GameSettings,
  LevelConfig,
  MissionResult,
  ScreenState,
  UpgradeKey,
  UpgradeLevels,
} from '../types/game';
import {
  formatRupees,
  getUpgradeCost,
  UPGRADE_DEFINITIONS,
} from '../data/upgrades';
import { LEVELS } from '../data/levels';
import heroBgUrl from '../assets/images/red_trail_hero_bg_1791438798350.jpg';
import portraitUrl from '../assets/images/smuggler_protagonist_portrait_1791438812171.jpg';
import truckArtUrl from '../assets/images/cargo_truck_illustration_1791438823432.jpg';

export function formatTimeMMSS(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel,
}) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#13261b] via-[#1c1311] to-[#08120c] text-stone-300 p-4 ${className}`}
      >
        <span className="font-display text-sm tracking-wider text-amber-400">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

interface TopNavProps {
  onNavigate: (screen: ScreenState) => void;
  onOpenSettings: () => void;
  onStartCurrentLevel: () => void;
}

export const TopNavContract: React.FC<TopNavProps> = ({
  onNavigate,
  onOpenSettings,
  onStartCurrentLevel,
}) => {
  return (
    <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#08120c]/90 backdrop-blur-md">
      {/* Zone 1: Single text element wordmark */}
      <button
        type="button"
        onClick={() => onNavigate('MAIN_MENU')}
        className="font-display text-xl font-bold tracking-wider text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
      >
        RED TRAIL
      </button>

      {/* Zone 2: 4 clean text navigation links */}
      <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-300">
        <button
          type="button"
          onClick={() => onNavigate('MISSIONS')}
          className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap"
        >
          Missions
        </button>
        <button
          type="button"
          onClick={() => onNavigate('UPGRADES')}
          className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap"
        >
          Upgrades
        </button>
        <button
          type="button"
          onClick={() => onNavigate('HOW_TO_PLAY')}
          className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap"
        >
          How to Play
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap"
        >
          Settings
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onStartCurrentLevel}
          className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-600 rounded-lg transition-colors whitespace-nowrap shadow-sm"
        >
          Start Game
        </button>
      </div>
    </header>
  );
};

interface MainMenuProps {
  money: number;
  reputation: number;
  unlockedLevel: number;
  selectedLevelId: number;
  onStartGame: () => void;
  onNavigate: (screen: ScreenState) => void;
  onOpenSettings: () => void;
}

export const MainMenuScreen: React.FC<MainMenuProps> = ({
  money,
  reputation,
  unlockedLevel,
  selectedLevelId,
  onStartGame,
  onNavigate,
  onOpenSettings,
}) => {
  const activeLevel =
    LEVELS.find((l) => l.id === selectedLevelId) || LEVELS[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#08120c] text-[#f4f1ea]">
      <TopNavContract
        onNavigate={onNavigate}
        onOpenSettings={onOpenSettings}
        onStartCurrentLevel={onStartGame}
      />

      {/* Hero Section */}
      <main className="relative flex-1 flex flex-col justify-between overflow-hidden">
        {/* Background Artwork + Measured Contrast Scrim */}
        <div className="absolute inset-0 z-0">
          <SafeImage
            src={heroBgUrl}
            alt="Dense Red Sandalwood Forest at Twilight"
            fallbackLabel="Seshachalam Red Timber Reserve"
            className="w-full h-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#08120c] via-[#08120c]/75 to-[#08120c]/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#08120c]/95 via-[#08120c]/65 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl w-full mx-auto px-6 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Primary Focal Anchor & Menu Actions */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-2 text-xs text-amber-300/90 font-medium">
              <span>Seshachalam Reserve</span>
              <span aria-hidden="true">·</span>
              <span>Red Timber Operations</span>
              <span aria-hidden="true">·</span>
              <span>Active Contract: {activeLevel.code}</span>
            </div>

            <div className="space-y-3">
              <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white">
                RED TRAIL
              </h1>
              <p className="font-display text-xl sm:text-2xl text-amber-400">
                Risk everything. Leave no trail.
              </p>
              <p className="text-base text-stone-300 max-w-xl leading-relaxed">
                Slip past forest checkposts, harvest prized crimson heartwood,
                outmaneuver rival syndicates, and haul your shipment through the
                mist to the safe zone before the sirens close in.
              </p>
            </div>

            {/* Primary Menu Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={onStartGame}
                className="px-7 py-3.5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold text-base shadow-lg transition-transform active:scale-95 whitespace-nowrap"
              >
                START GAME
              </button>
              <button
                type="button"
                onClick={() => onNavigate('MISSIONS')}
                className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-stone-100 font-semibold text-sm transition-colors whitespace-nowrap"
              >
                MISSIONS
              </button>
              <button
                type="button"
                onClick={() => onNavigate('UPGRADES')}
                className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-stone-100 font-semibold text-sm transition-colors whitespace-nowrap"
              >
                UPGRADES
              </button>
              <button
                type="button"
                onClick={() => onNavigate('HOW_TO_PLAY')}
                className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-stone-100 font-semibold text-sm transition-colors whitespace-nowrap"
              >
                HOW TO PLAY
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-stone-100 font-semibold text-sm transition-colors whitespace-nowrap"
              >
                SETTINGS
              </button>
            </div>

            {/* Unboxed Career Telemetry Bar */}
            <div className="pt-6 border-t border-white/10 grid grid-cols-3 gap-6 max-w-lg">
              <div>
                <div className="text-xs text-stone-400">Syndicate Funds</div>
                <div className="mt-1 font-mono text-xl font-bold text-amber-400 tabular-nums">
                  {formatRupees(money)}
                </div>
              </div>
              <div>
                <div className="text-xs text-stone-400">Reputation Standing</div>
                <div className="mt-1 font-mono text-xl font-bold text-white tabular-nums">
                  ⭐ {reputation}
                </div>
              </div>
              <div>
                <div className="text-xs text-stone-400">Unlocked Sector</div>
                <div className="mt-1 font-mono text-xl font-bold text-emerald-400 tabular-nums">
                  Level {unlockedLevel} / {LEVELS.length}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Smuggler Protagonist & Operation Dossier */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-white/10 bg-[#0d1d14]/90 backdrop-blur-md p-6 space-y-5 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-xl overflow-hidden shrink-0 border border-amber-500/30">
                  <SafeImage
                    src={portraitUrl}
                    alt="Vikram Redwood Rao"
                    fallbackLabel="Vikram"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-amber-400 font-medium">
                    Lead Runner · Original Character
                  </div>
                  <h2 className="font-display text-xl font-bold text-white">
                    Vikram &ldquo;Redwood&rdquo; Rao
                  </h2>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    Former forest tracker turned master timber runner. Knows
                    every hidden creek ford, bamboo thicket, and logging lorry
                    across the ghats.
                  </p>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span>Next Deployment</span>
                  <span>
                    {activeLevel.code} · {activeLevel.timeOfDay}
                  </span>
                </div>
                <div className="font-display text-lg font-bold text-white">
                  {activeLevel.id}. {activeLevel.title}
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  {activeLevel.description}
                </p>
                <div className="flex items-center gap-3 text-xs text-amber-300 font-mono tabular-nums pt-1">
                  <span>🪵 Target: {activeLevel.targetTimber} Units</span>
                  <span aria-hidden="true">·</span>
                  <span>💰 Base Pay: {formatRupees(activeLevel.baseReward)}</span>
                  <span aria-hidden="true">·</span>
                  <span>⭐ +{activeLevel.reputationReward} Rep</span>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden h-36 relative">
                <SafeImage
                  src={truckArtUrl}
                  alt="Forest Cargo Lorry"
                  fallbackLabel="Heavy Timber Lorry"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex items-end p-3.5">
                  <div className="text-xs text-stone-200">
                    <span className="font-semibold text-amber-300">
                      Tactical Tip:
                    </span>{' '}
                    Use forest cargo trucks for high-speed bulk runs, or stay on
                    foot to slip silently through dense thickets.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

interface MissionsScreenProps {
  unlockedLevel: number;
  selectedLevelId: number;
  onSelectAndStart: (levelId: number) => void;
  onBack: () => void;
}

export const MissionsScreen: React.FC<MissionsScreenProps> = ({
  unlockedLevel,
  selectedLevelId,
  onSelectAndStart,
  onBack,
}) => {
  return (
    <div className="min-h-screen bg-[#08120c] text-[#f4f1ea] px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div>
            <div className="text-xs text-amber-400 font-medium">
              Smuggling Operations · 5 Sectors
            </div>
            <h1 className="font-display text-3xl font-bold text-white mt-1">
              Select Forest Operation
            </h1>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-stone-200 transition-colors whitespace-nowrap"
          >
            Back to Main Menu
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {LEVELS.map((lvl) => {
            const isUnlocked = lvl.id <= unlockedLevel;
            const isSelected = lvl.id === selectedLevelId;
            return (
              <div
                key={lvl.id}
                className={`rounded-2xl border p-6 flex flex-col justify-between transition-colors ${
                  isSelected
                    ? 'border-amber-500/60 bg-[#112419]'
                    : 'border-white/10 bg-[#0d1c13]/90'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-stone-400">
                    <span>
                      {lvl.code} · {lvl.timeOfDay}
                    </span>
                    <span className="font-mono tabular-nums text-amber-400">
                      {formatRupees(lvl.baseReward)}
                    </span>
                  </div>

                  <h2 className="font-display text-xl font-bold text-white">
                    0{lvl.id}. {lvl.title}
                  </h2>

                  <div className="text-xs text-amber-300/90">
                    {lvl.subtitle}
                  </div>

                  <p className="text-sm text-stone-300 leading-relaxed">
                    {lvl.description}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-white/10 space-y-4">
                  <div className="flex items-center justify-between text-xs text-stone-300 font-mono tabular-nums">
                    <span>🪵 Quota: {lvl.targetTimber} Logs</span>
                    <span>⏱ {formatTimeMMSS(lvl.timeLimitSeconds)}</span>
                    <span>⭐ +{lvl.reputationReward}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectAndStart(lvl.id)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                      isUnlocked
                        ? 'bg-red-700 hover:bg-red-600 text-white'
                        : 'bg-amber-600/80 hover:bg-amber-500 text-slate-950'
                    }`}
                  >
                    {isUnlocked
                      ? `Deploy to ${lvl.title}`
                      : `Play ${lvl.title} (Early Access)`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface UpgradesScreenProps {
  money: number;
  reputation: number;
  upgrades: UpgradeLevels;
  onPurchaseUpgrade: (key: UpgradeKey) => void;
  onBack: () => void;
  onContinueMission: () => void;
}

export const UpgradesScreen: React.FC<UpgradesScreenProps> = ({
  money,
  reputation,
  upgrades,
  onPurchaseUpgrade,
  onBack,
  onContinueMission,
}) => {
  return (
    <div className="min-h-screen bg-[#08120c] text-[#f4f1ea] px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="text-xs text-amber-400 font-medium">
              Smuggler Camp Workshop · Gear &amp; Lorry Tuning
            </div>
            <h1 className="font-display text-3xl font-bold text-white mt-1">
              Syndicate Upgrades
            </h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-stone-400">Available Funds</div>
              <div className="font-mono text-xl font-bold text-amber-400 tabular-nums">
                💰 {formatRupees(money)} · ⭐ {reputation}
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-stone-200 transition-colors whitespace-nowrap"
              >
                Main Menu
              </button>
              <button
                type="button"
                onClick={onContinueMission}
                className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-xs font-semibold text-white transition-colors whitespace-nowrap"
              >
                Launch Operation
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {UPGRADE_DEFINITIONS.map((def, idx) => {
            const currentLvl = upgrades[def.key];
            const isMax = currentLvl >= def.maxLevel;
            const cost = getUpgradeCost(def, currentLvl);
            const canAfford = money >= cost && !isMax;

            return (
              <div
                key={def.key}
                className="rounded-2xl border border-white/10 bg-[#0d1c13]/90 p-6 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-stone-400 font-mono tabular-nums">
                    <span>0{idx + 1}. {def.unitLabel}</span>
                    <span>
                      Level {currentLvl} / {def.maxLevel}
                    </span>
                  </div>

                  <h2 className="font-display text-xl font-bold text-white">
                    {def.name}
                  </h2>

                  <p className="text-xs text-amber-300 font-medium">
                    {def.getEffectText(currentLvl)}
                  </p>

                  <p className="text-sm text-stone-300 leading-relaxed">
                    {def.description}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-white/10 space-y-3">
                  {/* Level Bar */}
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: def.maxLevel }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 flex-1 rounded-sm ${
                          i < currentLvl ? 'bg-amber-400' : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={!canAfford || isMax}
                    onClick={() => onPurchaseUpgrade(def.key)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold font-mono tabular-nums transition-colors whitespace-nowrap ${
                      isMax
                        ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 cursor-default'
                        : canAfford
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        : 'bg-white/5 border border-white/10 text-stone-500 cursor-not-allowed'
                    }`}
                  >
                    {isMax
                      ? 'MAX LEVEL REACHED'
                      : `UPGRADE · ${formatRupees(cost)}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface HowToPlayProps {
  onBack: () => void;
  onStartGame: () => void;
}

export const HowToPlayScreen: React.FC<HowToPlayProps> = ({
  onBack,
  onStartGame,
}) => {
  const steps = [
    {
      num: '01',
      title: 'Explore the Forest',
      body: 'Use WASD / Arrow Keys (or click on the map / use the mobile joystick) to navigate dirt trails, bridges, and dense crimson-wood groves.',
    },
    {
      num: '02',
      title: 'Collect Timber',
      body: 'Approach red sandalwood piles and press [E] or click "Collect". Carrying more logs increases your payout but adds weight and slows your stride.',
    },
    {
      num: '03',
      title: 'Avoid Police Patrols',
      body: 'Police officers and road jeeps sweep the forest with vision cones. Entering their sight raises your Detection Meter from Suspicious (40%) to Chase (80%+).',
    },
    {
      num: '04',
      title: 'Hide When Detected',
      body: 'Duck into Dense Forest thickets, Abandoned Sheds, Small Huts, Rocks, or Bushes and press [E] to Hide. While hidden out of sight, police rapidly lose your trail.',
    },
    {
      num: '05',
      title: 'Transport Your Cargo',
      body: 'Board parked Forest Cargo Trucks with [E] to haul up to 12 logs at high speed along roads—but watch out, trucks are louder and cannot cross rivers off-bridge.',
    },
    {
      num: '06',
      title: 'Reach the Safe Zone',
      body: 'Bring your harvested timber to the glowing green Extraction Safe Zone in the north and press [E] to deliver your shipment.',
    },
    {
      num: '07',
      title: 'Earn Money & Reputation',
      body: 'Every delivered log earns Indian Rupees (₹) and Syndicate Reputation (⭐), with extra speed bonuses for clean, low-alert operations.',
    },
    {
      num: '08',
      title: 'Upgrade Your Character',
      body: 'Invest your earnings into Footwork Speed, Timber Harness Capacity, Camouflage Stealth, Stamina, Lorry Engines, and Syndicate Payouts.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#08120c] text-[#f4f1ea] px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div>
            <div className="text-xs text-amber-400 font-medium">
              Smuggler Field Manual · Controls &amp; Tactics
            </div>
            <h1 className="font-display text-3xl font-bold text-white mt-1">
              How to Play RED TRAIL
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-stone-200 transition-colors whitespace-nowrap"
            >
              Back to Menu
            </button>
            <button
              type="button"
              onClick={onStartGame}
              className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-xs font-semibold text-white transition-colors whitespace-nowrap"
            >
              Start Operation
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s) => (
            <div
              key={s.num}
              className="rounded-2xl border border-white/10 bg-[#0d1c13]/90 p-5 space-y-2.5"
            >
              <div className="font-mono text-xs font-bold text-amber-400">
                STEP {s.num}
              </div>
              <h2 className="font-display text-lg font-bold text-white">
                {s.title}
              </h2>
              <p className="text-sm text-stone-300 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Controls Reference Strip */}
        <div className="rounded-2xl border border-white/10 bg-[#0d1c13]/90 p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-display text-base font-bold text-amber-400">
              Desktop Keyboard
            </h3>
            <p className="mt-1 text-xs text-stone-300 leading-relaxed">
              <strong>WASD / Arrows:</strong> Move &amp; Steer Lorry ·{' '}
              <strong>Shift:</strong> Sprint · <strong>E / Space:</strong>{' '}
              Collect / Hide / Vehicle / Deliver · <strong>Q:</strong> Drop 1
              Timber Log · <strong>F:</strong> Smoke Decoy
            </p>
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-amber-400">
              Mouse Interaction
            </h3>
            <p className="mt-1 text-xs text-stone-300 leading-relaxed">
              Click anywhere on the forest map to set a movement waypoint, or
              click directly on contextual action buttons when near timber,
              cover, or trucks.
            </p>
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-amber-400">
              Mobile &amp; Tablet
            </h3>
            <p className="mt-1 text-xs text-stone-300 leading-relaxed">
              Use the bottom-left virtual thumb joystick to move and the
              bottom-right touch cluster for contextual actions, sprinting, and
              smoke decoys.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PauseModalProps {
  level: LevelConfig;
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onMainMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  level,
  onResume,
  onRestart,
  onOpenSettings,
  onMainMenu,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0c1a12] p-7 space-y-6 shadow-2xl text-center">
        <div className="space-y-1">
          <div className="text-xs text-amber-400 font-medium">
            {level.code} · {level.title}
          </div>
          <h2 className="font-display text-3xl font-bold text-white">
            GAME PAUSED
          </h2>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 px-5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold text-sm transition-colors whitespace-nowrap"
          >
            RESUME
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-3 px-5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-stone-100 font-semibold text-sm transition-colors whitespace-nowrap"
          >
            RESTART MISSION
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full py-3 px-5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-stone-100 font-semibold text-sm transition-colors whitespace-nowrap"
          >
            SETTINGS
          </button>
          <button
            type="button"
            onClick={onMainMenu}
            className="w-full py-3 px-5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-stone-300 font-semibold text-sm transition-colors whitespace-nowrap"
          >
            MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
};

interface MissionCompleteModalProps {
  result: MissionResult;
  onContinue: () => void;
  onUpgrades: () => void;
  onReplay: () => void;
}

export const MissionCompleteModal: React.FC<MissionCompleteModalProps> = ({
  result,
  onContinue,
  onUpgrades,
  onReplay,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-[#0c1a12] p-8 space-y-6 shadow-2xl">
        <div className="space-y-1 text-center">
          <div className="text-xs text-emerald-400 font-semibold">
            Shipment Extracted Safely
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
            MISSION COMPLETE
          </h2>
          <p className="text-xs text-stone-300">{result.reason}</p>
        </div>

        <div className="border-y border-white/10 py-4 space-y-3 font-mono text-sm tabular-nums">
          <div className="flex items-center justify-between">
            <span className="text-stone-400 font-sans">Cargo Delivered</span>
            <span className="font-bold text-white">
              🪵 {result.cargoDelivered}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400 font-sans">Money Earned</span>
            <span className="font-bold text-amber-400">
              {formatRupees(result.moneyEarned)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400 font-sans">Time</span>
            <span className="font-bold text-stone-200">
              {formatTimeMMSS(result.timeSeconds)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400 font-sans">Police Alerts</span>
            <span className="font-bold text-stone-200">
              {result.policeAlerts}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400 font-sans">Reputation</span>
            <span className="font-bold text-emerald-400">
              +{result.reputationEarned}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={onContinue}
            className="py-3 px-4 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold text-xs transition-colors whitespace-nowrap"
          >
            CONTINUE
          </button>
          <button
            type="button"
            onClick={onUpgrades}
            className="py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors whitespace-nowrap"
          >
            UPGRADES
          </button>
          <button
            type="button"
            onClick={onReplay}
            className="py-3 px-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-stone-200 font-semibold text-xs transition-colors whitespace-nowrap"
          >
            REPLAY
          </button>
        </div>
      </div>
    </div>
  );
};

interface GameOverModalProps {
  result: MissionResult;
  onTryAgain: () => void;
  onExitMission: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  result,
  onTryAgain,
  onExitMission,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="w-full max-w-lg rounded-2xl border border-red-500/40 bg-[#140d0d] p-8 space-y-6 shadow-2xl">
        <div className="space-y-1.5 text-center">
          <div className="text-xs text-red-400 font-semibold">
            Operation Compromised
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
            MISSION FAILED
          </h2>
          <p className="text-sm text-stone-300">
            {result.reason || 'You were caught during the operation.'}
          </p>
        </div>

        <div className="border-y border-white/10 py-4 space-y-3 font-mono text-sm tabular-nums">
          <div className="flex items-center justify-between">
            <span className="text-stone-400 font-sans">Cargo Lost</span>
            <span className="font-bold text-red-400">
              🪵 {result.cargoLost} Units
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400 font-sans">Money Lost (Fines)</span>
            <span className="font-bold text-red-400">
              {formatRupees(result.moneyLost)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400 font-sans">Time Survived</span>
            <span className="font-bold text-stone-200">
              {formatTimeMMSS(result.timeSeconds)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onTryAgain}
            className="py-3 px-5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold text-xs transition-colors whitespace-nowrap"
          >
            TRY AGAIN
          </button>
          <button
            type="button"
            onClick={onExitMission}
            className="py-3 px-5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-stone-200 font-semibold text-xs transition-colors whitespace-nowrap"
          >
            EXIT MISSION
          </button>
        </div>
      </div>
    </div>
  );
};

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (next: GameSettings) => void;
  onResetSave: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onResetSave,
  onClose,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0c1a12] p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="font-display text-2xl font-bold text-white">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-stone-200 whitespace-nowrap"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-white">Synthesized Sound FX</div>
              <div className="text-xs text-stone-400">
                Audio cues for alerts, harvesting, and vehicles
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  soundEnabled: !settings.soundEnabled,
                })
              }
              className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${
                settings.soundEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/10 text-stone-400'
              }`}
            >
              {settings.soundEnabled ? 'Enabled' : 'Muted'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-white">Forest Radar Mini-Map</div>
              <div className="text-xs text-stone-400">
                Show tactical corner radar with timber &amp; patrol blips
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  showMiniMap: !settings.showMiniMap,
                })
              }
              className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${
                settings.showMiniMap
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/10 text-stone-400'
              }`}
            >
              {settings.showMiniMap ? 'Visible' : 'Hidden'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-white">Camera Perspective</div>
              <div className="text-xs text-stone-400">
                Close follow camera or wide tactical overview
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  cameraOverview: !settings.cameraOverview,
                })
              }
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-amber-300 whitespace-nowrap"
            >
              {settings.cameraOverview ? 'Wide Overview' : 'Follow Player'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-white">Touch Controls</div>
              <div className="text-xs text-stone-400">
                On-screen virtual joystick and buttons
              </div>
            </div>
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/10">
              {(['AUTO', 'ALWAYS', 'OFF'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ ...settings, touchControlsMode: mode })
                  }
                  className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                    settings.touchControlsMode === mode
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <div className="text-xs text-stone-400">
              Reset money, reputation, and upgrades
            </div>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="px-3.5 py-2 rounded-lg border border-red-500/40 bg-red-950/50 text-xs font-semibold text-red-300 hover:bg-red-900/60 whitespace-nowrap"
              >
                Reset Career
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onResetSave();
                  setConfirmReset(false);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-lg bg-red-600 text-xs font-bold text-white whitespace-nowrap"
              >
                Confirm Wipe
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
