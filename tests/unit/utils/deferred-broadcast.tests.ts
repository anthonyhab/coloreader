import {DeferredBroadcast} from '../../../src/background/utils/deferred-broadcast';

describe('DeferredBroadcast', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('delivers a deferred payload on the next idle tick, not before', () => {
        const delivered: Array<[number, string]> = [];
        const deferrer = new DeferredBroadcast<string>((key, payload) => delivered.push([key, payload]));

        deferrer.defer(1, 'palette-a');
        expect(delivered).toEqual([]);

        jest.advanceTimersByTime(0);
        expect(delivered).toEqual([[1, 'palette-a']]);
    });

    it('coalesces bursts per key: at most one pending delivery, latest payload wins', () => {
        const delivered: Array<[number, string]> = [];
        const deferrer = new DeferredBroadcast<string>((key, payload) => delivered.push([key, payload]));

        deferrer.defer(1, 'palette-a');
        deferrer.defer(2, 'palette-a');
        deferrer.defer(1, 'palette-b');
        deferrer.defer(1, 'palette-c');

        jest.advanceTimersByTime(0);
        expect(delivered).toEqual([
            [1, 'palette-c'],
            [2, 'palette-a'],
        ]);
    });

    it('cancels a pending delivery when the key is flushed synchronously', () => {
        const delivered: Array<[number, string]> = [];
        const deferrer = new DeferredBroadcast<string>((key, payload) => delivered.push([key, payload]));

        deferrer.defer(1, 'palette-a');
        deferrer.cancel(1);
        jest.advanceTimersByTime(0);
        expect(delivered).toEqual([]);

        // Cancel is scoped to the pending entry; later defers deliver normally.
        deferrer.defer(1, 'palette-b');
        jest.advanceTimersByTime(0);
        expect(delivered).toEqual([[1, 'palette-b']]);
    });

    it('tracks the number of pending keys', () => {
        const deferrer = new DeferredBroadcast<string>(() => {});

        deferrer.defer(1, 'palette-a');
        deferrer.defer(2, 'palette-b');
        deferrer.defer(1, 'palette-c');
        expect(deferrer.pendingCount()).toBe(2);

        deferrer.cancel(1);
        expect(deferrer.pendingCount()).toBe(1);

        jest.advanceTimersByTime(0);
        expect(deferrer.pendingCount()).toBe(0);
    });
});
