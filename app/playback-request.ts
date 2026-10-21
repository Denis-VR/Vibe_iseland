// Changing src or pausing cancels play(). Only the latest request may report
// an error; AbortError is expected during quick track changes.
export class PlaybackRequest {
  private generation = 0;
  cancel() { this.generation++; }
  async run(play: () => Promise<void>, failed: () => void) {
    const generation = ++this.generation;
    try { await play(); }
    catch (error) {
      if (generation !== this.generation) return;
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return;
      failed();
    }
  }
}
