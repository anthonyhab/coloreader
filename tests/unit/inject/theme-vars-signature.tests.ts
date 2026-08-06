import {ThemeVarsSignatureTracker} from '../../../src/inject/dynamic-theme/theme-vars-signature';

describe('ThemeVarsSignatureTracker', () => {
    it('skips only an exact repeat of the last applied signature', () => {
        const tracker = new ThemeVarsSignatureTracker();

        expect(tracker.isDuplicate('dark\u0000#102030\u0000#f0e0d0\u0000#405060')).toBe(false);
        tracker.record('dark\u0000#102030\u0000#f0e0d0\u0000#405060');
        expect(tracker.isDuplicate('dark\u0000#102030\u0000#f0e0d0\u0000#405060')).toBe(true);
        expect(tracker.isDuplicate('dark\u0000#102031\u0000#f0e0d0\u0000#405060')).toBe(false);
    });

    it('does not skip when the message carries no signature (legacy broadcasts)', () => {
        const tracker = new ThemeVarsSignatureTracker();

        tracker.record('dark\u0000#102030\u0000#f0e0d0\u0000#405060');
        expect(tracker.isDuplicate(null)).toBe(false);
        expect(tracker.isDuplicate(undefined)).toBe(false);
    });

    it('reset() re-arms dedup after a full theme rebuild', () => {
        const tracker = new ThemeVarsSignatureTracker();

        tracker.record('dark\u0000#102030\u0000#f0e0d0\u0000#405060');
        tracker.reset();
        expect(tracker.isDuplicate('dark\u0000#102030\u0000#f0e0d0\u0000#405060')).toBe(false);
    });
});
