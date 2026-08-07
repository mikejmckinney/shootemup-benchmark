export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
}

export class InputController {
  readonly state: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    fire: false,
  };

  private keyHandler = (e: KeyboardEvent, down: boolean) => {
    const k = e.key.toLowerCase();
    if (
      ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'a', 'd', 'w', 's'].includes(k) ||
      e.code === 'Space'
    ) {
      e.preventDefault();
    }
    if (k === 'arrowleft' || k === 'a') this.state.left = down;
    if (k === 'arrowright' || k === 'd') this.state.right = down;
    if (k === 'arrowup' || k === 'w') this.state.up = down;
    if (k === 'arrowdown' || k === 's') this.state.down = down;
    if (k === ' ' || e.code === 'Space') this.state.fire = down;
  };

  attach(): void {
    window.addEventListener('keydown', (e) => this.keyHandler(e, true));
    window.addEventListener('keyup', (e) => this.keyHandler(e, false));
  }

  setTouch(dir: keyof InputState, down: boolean): void {
    this.state[dir] = down;
  }

  resetMovement(): void {
    this.state.left = false;
    this.state.right = false;
    this.state.up = false;
    this.state.down = false;
    this.state.fire = false;
  }
}
