import type { InputState } from './types';

export type InputButton = keyof InputState;

export interface InputController {
  getState(): InputState;
  setButton(button: InputButton, value: boolean): void;
  reset(): void;
  attach(): () => void;
}

const keyMap: Record<string, InputButton> = {
  ArrowLeft: 'left',
  a: 'left',
  A: 'left',
  ArrowRight: 'right',
  d: 'right',
  D: 'right',
  ArrowUp: 'up',
  w: 'up',
  W: 'up',
  ArrowDown: 'down',
  s: 'down',
  S: 'down',
  ' ': 'fire',
};

export function createInputController(): InputController {
  let state: InputState = { left: false, right: false, up: false, down: false, fire: false };

  const setButton = (button: InputButton, value: boolean) => {
    state = { ...state, [button]: value };
  };

  const reset = () => {
    state = { left: false, right: false, up: false, down: false, fire: false };
  };

  const onKey = (event: KeyboardEvent, value: boolean) => {
    const button = keyMap[event.key];
    if (!button) return;
    event.preventDefault();
    setButton(button, value);
  };

  return {
    getState: () => ({ ...state }),
    setButton,
    reset,
    attach: () => {
      const down = (event: KeyboardEvent) => onKey(event, true);
      const up = (event: KeyboardEvent) => onKey(event, false);
      window.addEventListener('keydown', down);
      window.addEventListener('keyup', up);
      window.addEventListener('blur', reset);
      return () => {
        window.removeEventListener('keydown', down);
        window.removeEventListener('keyup', up);
        window.removeEventListener('blur', reset);
        reset();
      };
    },
  };
}
