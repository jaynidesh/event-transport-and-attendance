export class PullRefresh {
  readonly threshold = 80;
  distance = 0;
  private origin: {x: number; y: number} | null = null;
  start(x: number, y: number, allowed: boolean) {
    this.cancel();
    if (allowed) this.origin = {x, y};
  }
  move(x: number, y: number): boolean {
    if (!this.origin) return false;
    const dx = Math.abs(x - this.origin.x), dy = y - this.origin.y;
    if (dy < 0 || dx >= Math.max(10, dy)) { this.cancel(); return false; }
    this.distance = Math.min(120, dy);
    return dy > 8;
  }
  release(): boolean {
    const ready = this.distance >= this.threshold;
    this.cancel();
    return ready;
  }
  cancel() { this.origin = null; this.distance = 0; }
}
