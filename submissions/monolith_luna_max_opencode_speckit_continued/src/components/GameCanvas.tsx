import { useEffect, useRef } from 'react';
import type { InputController } from '../game/input';
import { renderGame } from '../game/render';
import type { GameSession, InputState } from '../game/types';

interface GameCanvasProps {
  session: GameSession;
  onStep: (input: InputState, deltaMs: number) => void;
  inputController: InputController;
}

export default function GameCanvas({ session, onStep, inputController }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef(session);
  const onStepRef = useRef(onStep);
  sessionRef.current = session;
  onStepRef.current = onStep;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const cleanupInput = inputController.attach();
    const context = canvas.getContext('2d');
    if (!context) return cleanupInput;

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(100, now - last);
      last = now;
      const current = sessionRef.current;
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(current.bounds.width * dpr));
      const height = Math.max(1, Math.round(current.bounds.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderGame(context, current, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      if (current.phase === 'playing') onStepRef.current(inputController.getState(), delta);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      cleanupInput();
    };
  }, [inputController]);

  return <canvas ref={canvasRef} data-testid="game-canvas" className="game-canvas" aria-label="Neon Barrage game" />;
}
