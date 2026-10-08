/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import {
  GameSettings,
  MissionResult,
  ScreenState,
  UpgradeKey,
  UpgradeLevels,
} from './types/game';
import {
  getUpgradeCost,
  INITIAL_UPGRADES,
  UPGRADE_DEFINITIONS,
} from './data/upgrades';
import { LEVELS } from './data/levels';
import { GameCanvas } from './components/GameCanvas';
import {
  GameOverModal,
  HowToPlayScreen,
  MainMenuScreen,
  MissionCompleteModal,
  MissionsScreen,
  PauseModal,
  SettingsModal,
  UpgradesScreen,
} from './components/Modals';
import { soundFX } from './utils/sound';

const STORAGE_KEY = 'red_trail_save_v1';

interface SavedCareer {
  money: number;
  reputation: number;
  unlockedLevel: number;
  selectedLevelId: number;
  upgrades: UpgradeLevels;
  settings: GameSettings;
}

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  showMiniMap: true,
  touchControlsMode: 'AUTO',
  cameraOverview: false,
};

function loadCareer(): SavedCareer {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        money: typeof parsed.money === 'number' ? parsed.money : 2500,
        reputation: typeof parsed.reputation === 'number' ? parsed.reputation : 10,
        unlockedLevel:
          typeof parsed.unlockedLevel === 'number' ? parsed.unlockedLevel : 1,
        selectedLevelId:
          typeof parsed.selectedLevelId === 'number' ? parsed.selectedLevelId : 1,
        upgrades: { ...INITIAL_UPGRADES, ...(parsed.upgrades || {}) },
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    money: 2500,
    reputation: 10,
    unlockedLevel: 1,
    selectedLevelId: 1,
    upgrades: { ...INITIAL_UPGRADES },
    settings: { ...DEFAULT_SETTINGS },
  };
}

export default function App() {
  const initial = loadCareer();
  const [screen, setScreen] = useState<ScreenState>('MAIN_MENU');
  const [money, setMoney] = useState<number>(initial.money);
  const [reputation, setReputation] = useState<number>(initial.reputation);
  const [unlockedLevel, setUnlockedLevel] = useState<number>(initial.unlockedLevel);
  const [selectedLevelId, setSelectedLevelId] = useState<number>(
    initial.selectedLevelId
  );
  const [upgrades, setUpgrades] = useState<UpgradeLevels>(initial.upgrades);
  const [settings, setSettings] = useState<GameSettings>(initial.settings);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<MissionResult | null>(null);
  const [runKey, setRunKey] = useState<number>(1);

  useEffect(() => {
    soundFX.enabled = settings.soundEnabled;
    try {
      const payload: SavedCareer = {
        money,
        reputation,
        unlockedLevel,
        selectedLevelId,
        upgrades,
        settings,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  }, [money, reputation, unlockedLevel, selectedLevelId, upgrades, settings]);

  const activeLevel =
    LEVELS.find((l) => l.id === selectedLevelId) || LEVELS[0];

  const handleStartLevel = (levelId?: number) => {
    soundFX.playClick();
    if (levelId) {
      setSelectedLevelId(levelId);
    }
    setLastResult(null);
    setRunKey((prev) => prev + 1);
    setScreen('PLAYING');
  };

  const handleMissionComplete = (result: MissionResult) => {
    setLastResult(result);
    setMoney((prev) => prev + result.moneyEarned);
    setReputation((prev) => prev + result.reputationEarned);

    const nextLevelId = Math.min(LEVELS.length, result.levelId + 1);
    setUnlockedLevel((prev) => Math.max(prev, nextLevelId));
    setScreen('MISSION_COMPLETE');
  };

  const handleMissionFailed = (result: MissionResult) => {
    setLastResult(result);
    setMoney((prev) => Math.max(0, prev - result.moneyLost));
    setScreen('GAME_OVER');
  };

  const handlePurchaseUpgrade = (key: UpgradeKey) => {
    const def = UPGRADE_DEFINITIONS.find((d) => d.key === key);
    if (!def) return;
    const currentLvl = upgrades[key];
    if (currentLvl >= def.maxLevel) return;
    const cost = getUpgradeCost(def, currentLvl);
    if (money < cost) return;

    soundFX.playDeliverCargo();
    setMoney((prev) => prev - cost);
    setUpgrades((prev) => ({
      ...prev,
      [key]: prev[key] + 1,
    }));
  };

  const handleResetSave = () => {
    soundFX.playClick();
    setMoney(2500);
    setReputation(10);
    setUnlockedLevel(1);
    setSelectedLevelId(1);
    setUpgrades({ ...INITIAL_UPGRADES });
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="min-h-screen w-full bg-[#08120c] text-[#f4f1ea] overflow-x-hidden">
      {screen === 'MAIN_MENU' && (
        <MainMenuScreen
          money={money}
          reputation={reputation}
          unlockedLevel={unlockedLevel}
          selectedLevelId={selectedLevelId}
          onStartGame={() => handleStartLevel(selectedLevelId)}
          onNavigate={(next) => {
            soundFX.playClick();
            setScreen(next);
          }}
          onOpenSettings={() => {
            soundFX.playClick();
            setSettingsOpen(true);
          }}
        />
      )}

      {screen === 'MISSIONS' && (
        <MissionsScreen
          unlockedLevel={unlockedLevel}
          selectedLevelId={selectedLevelId}
          onSelectAndStart={(lvlId) => handleStartLevel(lvlId)}
          onBack={() => {
            soundFX.playClick();
            setScreen('MAIN_MENU');
          }}
        />
      )}

      {screen === 'UPGRADES' && (
        <UpgradesScreen
          money={money}
          reputation={reputation}
          upgrades={upgrades}
          onPurchaseUpgrade={handlePurchaseUpgrade}
          onBack={() => {
            soundFX.playClick();
            setScreen('MAIN_MENU');
          }}
          onContinueMission={() => handleStartLevel(selectedLevelId)}
        />
      )}

      {screen === 'HOW_TO_PLAY' && (
        <HowToPlayScreen
          onBack={() => {
            soundFX.playClick();
            setScreen('MAIN_MENU');
          }}
          onStartGame={() => handleStartLevel(selectedLevelId)}
        />
      )}

      {(screen === 'PLAYING' ||
        screen === 'PAUSED' ||
        screen === 'MISSION_COMPLETE' ||
        screen === 'GAME_OVER') && (
        <GameCanvas
          key={`${activeLevel.id}-${runKey}`}
          level={activeLevel}
          money={money}
          reputation={reputation}
          upgrades={upgrades}
          settings={settings}
          isPaused={screen !== 'PLAYING' || settingsOpen}
          onPauseToggle={() => {
            soundFX.playClick();
            setScreen((prev) => (prev === 'PAUSED' ? 'PLAYING' : 'PAUSED'));
          }}
          onOpenSettings={() => {
            soundFX.playClick();
            setSettingsOpen(true);
          }}
          onMissionComplete={handleMissionComplete}
          onMissionFailed={handleMissionFailed}
        />
      )}

      {screen === 'PAUSED' && !settingsOpen && (
        <PauseModal
          level={activeLevel}
          onResume={() => {
            soundFX.playClick();
            setScreen('PLAYING');
          }}
          onRestart={() => handleStartLevel(activeLevel.id)}
          onOpenSettings={() => {
            soundFX.playClick();
            setSettingsOpen(true);
          }}
          onMainMenu={() => {
            soundFX.playClick();
            setScreen('MAIN_MENU');
          }}
        />
      )}

      {screen === 'MISSION_COMPLETE' && lastResult && (
        <MissionCompleteModal
          result={lastResult}
          onContinue={() => {
            const nextId =
              activeLevel.id < LEVELS.length ? activeLevel.id + 1 : 1;
            handleStartLevel(nextId);
          }}
          onUpgrades={() => {
            soundFX.playClick();
            if (activeLevel.id < LEVELS.length) {
              setSelectedLevelId(activeLevel.id + 1);
            }
            setScreen('UPGRADES');
          }}
          onReplay={() => handleStartLevel(activeLevel.id)}
        />
      )}

      {screen === 'GAME_OVER' && lastResult && (
        <GameOverModal
          result={lastResult}
          onTryAgain={() => handleStartLevel(activeLevel.id)}
          onExitMission={() => {
            soundFX.playClick();
            setScreen('MAIN_MENU');
          }}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={(next) => {
            soundFX.playClick();
            setSettings(next);
          }}
          onResetSave={handleResetSave}
          onClose={() => {
            soundFX.playClick();
            setSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}
