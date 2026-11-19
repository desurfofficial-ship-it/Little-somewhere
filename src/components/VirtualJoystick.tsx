import React, { useRef, useState } from 'react';
import { ScreenVec2 } from '../game/types';

interface VirtualJoystickProps {
  vectorRef: React.MutableRefObject<ScreenVec2>;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ vectorRef }) => {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);
  const maxRadius = 34;

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    setKnobOffset({ x: dx, y: dy });
    vectorRef.current = {
      x: dx / maxRadius,
      y: dy / maxRadius,
    };
  };

  const reset = () => {
    activePointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    vectorRef.current = { x: 0, y: 0 };
  };

  return (
    <div
      ref={baseRef}
      aria-label="Movement thumbstick"
      role="application"
      onPointerDown={(e) => {
        e.stopPropagation();
        activePointerId.current = e.pointerId;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        updateFromClient(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (activePointerId.current !== e.pointerId) return;
        updateFromClient(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (activePointerId.current !== e.pointerId) return;
        reset();
      }}
      onPointerCancel={reset}
      className="relative w-24 h-24 shrink-0 rounded-full bg-[#FAF5EC]/85 border-2 border-[#CBBBA3] shadow-[0_6px_20px_rgba(45,36,30,0.16)] flex items-center justify-center touch-none pointer-events-auto cursor-grab active:cursor-grabbing"
    >
      {/* Compass ticks */}
      <div className="absolute inset-2 rounded-full border border-dashed border-[#D8C9B4] pointer-events-none" />
      {/* Tactile clay thumb knob */}
      <div
        style={{
          transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
        }}
        className="w-10 h-10 rounded-full bg-[#C86446] border-2 border-[#FAF5EC] shadow-md pointer-events-none transition-transform duration-75"
      />
    </div>
  );
};
