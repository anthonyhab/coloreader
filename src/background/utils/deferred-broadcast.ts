/**
 * Coalescing idle scheduler for per-key broadcasts (keyed by tab id).
 *
 * At most one pending deferred delivery exists per key: a newer payload
 * replaces the pending one instead of queueing another tick, so a burst of
 * broadcasts costs exactly one idle wakeup per key and always delivers the
 * newest payload. `cancel()` drops a pending delivery, e.g. when the key
 * became visible and the payload was already delivered synchronously.
 */
export class DeferredBroadcast<T> {
    private pending = new Map<number, {payload: T; timer: ReturnType<typeof setTimeout> | null}>();

    constructor(
        private readonly deliver: (key: number, payload: T) => void,
        private readonly schedule: (run: () => void) => ReturnType<typeof setTimeout> = (run) => setTimeout(run, 0),
    ) {}

    defer(key: number, payload: T): void {
        const existing = this.pending.get(key);
        if (existing) {
            existing.payload = payload;
            return;
        }
        const entry: {payload: T; timer: ReturnType<typeof setTimeout> | null} = {payload, timer: null};
        entry.timer = this.schedule(() => {
            if (this.pending.get(key) !== entry) {
                return;
            }
            this.pending.delete(key);
            this.deliver(key, entry.payload);
        });
        this.pending.set(key, entry);
    }

    cancel(key: number): void {
        const entry = this.pending.get(key);
        if (!entry) {
            return;
        }
        clearTimeout(entry.timer!);
        this.pending.delete(key);
    }

    pendingCount(): number {
        return this.pending.size;
    }
}
