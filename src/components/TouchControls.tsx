import React, { useRef, useState } from 'react';
import { ContextualAction, Vector2D } from '../types/game';

interface TouchControlsProps {
  onMoveVector: (vec: Vector2D) => void;
  onSprintChange: (sprinting: boolean) => void;
  onTriggerContextAction: () => void;
  onDropCargo: () => void;
  onUseDecoy: () => void;
  contextAction: ContextualAction | null;
  hasCargo: boolean;
  decoyCooldown: number;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onMoveVector,
  onSprintChange,
  onTriggerContextAction,
  onDropCargo,
  onUseDecoy,
  contextAction,
  hasCargo,
  decoyCooldown,
}) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knobOffset, setKnobOffset] = useState<Vector2D>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const maxRadius = 42;

  const updateJoystick = (clientX: number, clientY: number) => {
    if (!baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist === 0) {
      setKnobOffset({ x: 0, y: 0 });
      onMoveVector({ x: 0, y: 0 });
      return;
    }

    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * (clampedDist / maxRadius);
    const ny = Math.sin(angle) * (clampedDist / maxRadius);

    setKnobOffset({
      x: Math.cos(angle) * clampedDist,
      y: Math.sin(angle) * clampedDist,
    });
    onMoveVector({ x: nx, y: ny });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateJoystick(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.stopPropagation();
    updateJoystick(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDragging(false);
    setKnobOffset({ x: 0, y: 0 });
    onMoveVector({ x: 0, y: 0 });
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex items-end justify-between px-4 sm:px-6">
      {/* Left Virtual Joystick */}
      <div
        ref={baseRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="pointer-events-auto relative flex h-28 w-28 items-center justify-center rounded-full border border-white/20 bg-black/50 backdrop-blur-md game-touch-surface"
        aria-label="Movement Joystick"
      >
        <div className="pointer-events-none h-16 w-16 rounded-full border border-white/10 bg-white/5" />
        <div
          style={{
            transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          }}
          className="pointer-events-none absolute h-12 w-12 rounded-full border border-amber-400/60 bg-gradient-to-b from-amber-500/80 to-red-800/90 shadow-lg"
        />
      </div>

      {/* Right Action Cluster */}
      <div className="pointer-events-auto flex flex-col items-end gap-2.5">
        {contextAction && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTriggerContextAction();
            }}
            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-semibold text-sm shadow-lg active:scale-95 transition-transform whitespace-nowrap"
          >
            {contextAction.label}
          </button>
        )}

        <div className="flex items-center gap-2.5">
          {hasCargo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDropCargo();
              }}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-white/15 bg-black/65 text-xs font-medium text-stone-200 backdrop-blur-md active:scale-95 transition-transform whitespace-nowrap"
            >
              Drop Log
            </button>
          )}

          <button
            type="button"
            disabled={decoyCooldown > 0}
            onClick={(e) => {
              e.stopPropagation();
              onUseDecoy();
            }}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-medium backdrop-blur-md transition-transform whitespace-nowrap ${
              decoyCooldown > 0
                ? 'border-white/10 bg-black/40 text-stone-500'
                : 'border-red-500/40 bg-red-950/80 text-red-200 active:scale-95'
            }`}
          >
            {decoyCooldown > 0 ? `Smoke (${Math.ceil(decoyCooldown)}s)` : 'Smoke Decoy'}
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onSprintChange(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onSprintChange(false);
            }}
            onPointerLeave={() => onSprintChange(false)}
            className="min-h-[48px] px-4 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/80 text-xs font-semibold text-emerald-200 backdrop-blur-md active:scale-95 transition-transform whitespace-nowrap"
          >
            Hold Sprint
          </button>
        </div>
      </div>
    </div>
  );
};
