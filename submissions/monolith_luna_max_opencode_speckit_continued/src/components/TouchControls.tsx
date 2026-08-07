import type { InputButton, InputController } from '../game/input';

interface TouchControlsProps {
  controller: InputController | null;
  onInteraction: () => void;
}

const controls: Array<{ button: InputButton; label: string; glyph: string }> = [
  { button: 'left', label: 'Move left', glyph: '<' },
  { button: 'up', label: 'Move up', glyph: '^' },
  { button: 'down', label: 'Move down', glyph: 'v' },
  { button: 'right', label: 'Move right', glyph: '>' },
];

export default function TouchControls({ controller, onInteraction }: TouchControlsProps) {
  const set = (button: InputButton, value: boolean) => {
    onInteraction();
    controller?.setButton(button, value);
  };

  return (
    <div className="touch-controls" data-testid="touch-controls" aria-label="Touch game controls">
      <div className="direction-pad">
        {controls.map(({ button, label, glyph }) => (
          <button
            key={button}
            type="button"
            className={`touch-button touch-${button}`}
            aria-label={label}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              set(button, true);
            }}
            onPointerUp={() => set(button, false)}
            onPointerCancel={() => set(button, false)}
            onPointerLeave={() => set(button, false)}
          >
            {glyph}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="fire-button"
        aria-label="Fire"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          set('fire', true);
        }}
        onPointerUp={() => set('fire', false)}
        onPointerCancel={() => set('fire', false)}
        onPointerLeave={() => set('fire', false)}
      >
        FIRE
      </button>
    </div>
  );
}
