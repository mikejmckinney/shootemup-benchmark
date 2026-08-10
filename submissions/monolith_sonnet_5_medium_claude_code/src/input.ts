export class InputManager {
  private keys = new Set<string>();
  touchDx = 0;
  touchDy = 0;
  touchFiring = false;
  private stickActive = false;
  private stickOrigin: { x: number; y: number } | null = null;
  private stickTouchId: number | null = null;

  constructor(
    private stickEl: HTMLElement,
    private stickNub: HTMLElement,
    private fireEl: HTMLElement,
  ) {
    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());

    this.stickEl.addEventListener("touchstart", this.onStickStart, { passive: false });
    this.stickEl.addEventListener("touchmove", this.onStickMove, { passive: false });
    this.stickEl.addEventListener("touchend", this.onStickEnd, { passive: false });
    this.stickEl.addEventListener("touchcancel", this.onStickEnd, { passive: false });

    this.fireEl.addEventListener("touchstart", this.onFireStart, { passive: false });
    this.fireEl.addEventListener("touchend", this.onFireEnd, { passive: false });
    this.fireEl.addEventListener("touchcancel", this.onFireEnd, { passive: false });
  }

  private onStickStart = (e: TouchEvent): void => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    this.stickTouchId = touch.identifier;
    const rect = this.stickEl.getBoundingClientRect();
    this.stickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.stickActive = true;
  };

  private onStickMove = (e: TouchEvent): void => {
    e.preventDefault();
    if (!this.stickActive || !this.stickOrigin) return;
    const touch = Array.from(e.changedTouches).find((t) => t.identifier === this.stickTouchId);
    if (!touch) return;
    const maxDist = 46;
    let dx = touch.clientX - this.stickOrigin.x;
    let dy = touch.clientY - this.stickOrigin.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }
    this.touchDx = dx / maxDist;
    this.touchDy = dy / maxDist;
    this.stickNub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  };

  private onStickEnd = (e: TouchEvent): void => {
    e.preventDefault();
    this.stickActive = false;
    this.stickOrigin = null;
    this.stickTouchId = null;
    this.touchDx = 0;
    this.touchDy = 0;
    this.stickNub.style.transform = "translate(-50%, -50%)";
  };

  private onFireStart = (e: TouchEvent): void => {
    e.preventDefault();
    this.touchFiring = true;
  };

  private onFireEnd = (e: TouchEvent): void => {
    e.preventDefault();
    this.touchFiring = false;
  };

  get up(): boolean {
    return this.keys.has("ArrowUp") || this.keys.has("KeyW") || this.touchDy < -0.2;
  }
  get down(): boolean {
    return this.keys.has("ArrowDown") || this.keys.has("KeyS") || this.touchDy > 0.2;
  }
  get left(): boolean {
    return this.keys.has("ArrowLeft") || this.keys.has("KeyA") || this.touchDx < -0.2;
  }
  get right(): boolean {
    return this.keys.has("ArrowRight") || this.keys.has("KeyD") || this.touchDx > 0.2;
  }
  get firing(): boolean {
    return this.keys.has("Space") || this.touchFiring;
  }

  axisX(): number {
    if (Math.abs(this.touchDx) > 0.2) return this.touchDx;
    return (this.right ? 1 : 0) - (this.left ? 1 : 0);
  }
  axisY(): number {
    if (Math.abs(this.touchDy) > 0.2) return this.touchDy;
    return (this.down ? 1 : 0) - (this.up ? 1 : 0);
  }
}
