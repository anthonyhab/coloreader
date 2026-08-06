/**
 * Benchmark: entry-to-apply wall time of the external `setThemeVars` fast
 * path in the coloreader background script.
 *
 * This file is intentionally EXCLUDED from the default unit suite
 * (testMatch in tests/unit/jest.config.mjs covers tests/unit only) and runs
 * via `npm run test:bench`.
 *
 * It drives the exact chain the pywalfox external connection would drive:
 *   Extension.externalRequestsHandler({type: 'setThemeVars', ...})
 *   -> validatePywalThemeVars -> setThemeVars
 *   -> UserStorage.set + setWindowTheme (browser.theme.update)
 *   + TabManager.broadcastMessage
 *
 * Measurement is pure JS wall time (performance.now) from the entry of
 * externalRequestsHandler to the invocation of browser.theme.update
 * (captured inside the mocked update call), over 30 distinct payloads.
 */
import {DEFAULT_SETTINGS} from '../../src/defaults';
import type {ExternalConnection, MessageBGtoCS, UserSettings} from '../../src/definitions';
import {Extension} from '../../src/background/extension';
import TabManager from '../../src/background/tab-manager';
import UserStorage from '../../src/background/user-storage';
import {validatePywalThemeVars} from '../../src/background/pywal-theme';
import {MessageTypeBGtoCS} from '../../src/utils/message';

const ITERATIONS = 30;

interface ThemeVarsPayload {
    type: string;
    data: Record<string, unknown>;
}

interface Stats {
    min: number;
    p50: number;
    p95: number;
    max: number;
    mean: number;
}

// The browser/chrome globals do not exist in the node test env, so the test
// doubles are attached through unchecked casts of the global object.
function mockExtensionGlobals(): {themeUpdate: jest.Mock} {
    const globalWithBrowser = globalThis as unknown as {
        browser: {theme: {update: jest.Mock; reset: jest.Mock}};
    };
    globalWithBrowser.browser = {theme: {update: jest.fn(), reset: jest.fn()}};

    const globalWithChrome = globalThis as unknown as {
        chrome: {
            runtime: {
                onConnect: {addListener: jest.Mock};
                onMessage: {addListener: jest.Mock};
                lastError: unknown;
            };
            storage: {
                local: {get: jest.Mock; set: jest.Mock};
                sync: {get: jest.Mock; set: jest.Mock};
            };
            tabs: {onRemoved: {addListener: jest.Mock}};
        };
    };
    globalWithChrome.chrome = {
        runtime: {
            onConnect: {addListener: jest.fn()},
            onMessage: {addListener: jest.fn()},
            lastError: null,
        },
        storage: {
            local: {
                get: jest.fn(),
                set: jest.fn((_values: unknown, callback?: () => void) => {
                    callback?.();
                }),
            },
            sync: {get: jest.fn(), set: jest.fn()},
        },
        tabs: {onRemoved: {addListener: jest.fn()}},
    };
    return {themeUpdate: globalWithBrowser.browser.theme.update};
}

// Wire the real background building blocks the fast path touches: the tab
// registry (broadcastMessage iterates it) and a settings fixture that keeps
// the extension switched on with browser-theme changes enabled.
function initBench(): {themeUpdate: jest.Mock} {
    const {themeUpdate} = mockExtensionGlobals();
    const testMessage: MessageBGtoCS = {type: MessageTypeBGtoCS.UPDATE_THEME_VARS};
    TabManager.init({
        getConnectionMessage: async () => testMessage,
        getTabMessage: () => testMessage,
        onColorSchemeChange: () => {},
    });
    const benchSettings: UserSettings = {
        ...DEFAULT_SETTINGS,
        changeBrowserTheme: true,
        theme: {...DEFAULT_SETTINGS.theme, selectionColor: '#405060'},
    };
    UserStorage.settings = benchSettings;
    return {themeUpdate};
}

// Dark-scheme payloads, distinct across seeds (bg/fg/sel all vary per seed).
function makePayload(seed: number): ThemeVarsPayload {
    const bg = `#${(((seed << 8) | 0x10) % 0x1000000).toString(16).padStart(6, '0')}`;
    const fg = `#${((((0xff - seed) << 8) | 0xe0) % 0x1000000).toString(16).padStart(6, '0')}`;
    const sel = `#${((0x80 | seed) % 0x1000000).toString(16).padStart(6, '0')}`;
    return {
        type: 'setThemeVars',
        data: {
            darkSchemeBackgroundColor: bg,
            darkSchemeTextColor: fg,
            selectionColor: sel,
        },
    };
}

// Nearest-rank percentile: the q-th quantile of an ascending sample.
function percentile(sorted: number[], q: number): number {
    return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function summarize(samples: number[]): Stats {
    const sorted = [...samples].sort((a, b) => a - b);
    const sum = samples.reduce((acc, value) => acc + value, 0);
    return {
        min: sorted[0],
        p50: percentile(sorted, 0.5),
        p95: percentile(sorted, 0.95),
        max: sorted[sorted.length - 1],
        mean: sum / samples.length,
    };
}

function formatStats(label: string, samples: number[]): Stats {
    const stats = summarize(samples);
    console.log(
        `[bench] ${label}: n=${samples.length} ` +
        `min=${stats.min.toFixed(3)} p50=${stats.p50.toFixed(3)} ` +
        `p95=${stats.p95.toFixed(3)} max=${stats.max.toFixed(3)} ` +
        `mean=${stats.mean.toFixed(3)} ms`,
    );
    return stats;
}

describe('theme apply benchmark (excluded from the default suite)', () => {
    test('externalRequestsHandler(setThemeVars) -> browser.theme.update wall time over 30 distinct payloads', () => {
        const {themeUpdate} = initBench();
        const connection = DEFAULT_SETTINGS.externalConnections.find(({id}) =>
            id === 'pywalfox@frewacom.org'
        ) as ExternalConnection;

        const samples: number[] = [];
        let applyAt = 0;
        themeUpdate.mockImplementation(() => {
            applyAt = performance.now();
        });

        for (let seed = 0; seed < ITERATIONS; seed++) {
            applyAt = 0;
            const start = performance.now();
            Extension.externalRequestsHandler(makePayload(seed), connection);
            samples.push(applyAt - start);
            expect(applyAt).toBeGreaterThan(0); // every iteration reached the theme API
        }

        expect(themeUpdate).toHaveBeenCalledTimes(ITERATIONS);
        const stats = formatStats('coloreader externalRequestsHandler(setThemeVars) -> browser.theme.update', samples);
        expect(stats.max).toBeGreaterThanOrEqual(0);
    });

    test('validatePywalThemeVars isolation over 30 distinct payloads', () => {
        const samples: number[] = [];
        for (let seed = 0; seed < ITERATIONS; seed++) {
            const start = performance.now();
            const vars = validatePywalThemeVars(makePayload(seed).data);
            samples.push(performance.now() - start);
            expect(vars).not.toBeNull();
        }
        const stats = formatStats('coloreader validatePywalThemeVars (isolated)', samples);
        expect(stats.max).toBeGreaterThanOrEqual(0);
    });

    test('the measured setThemeVars path is synchronous: no await/promise boundary before the apply', () => {
        const {themeUpdate} = initBench();
        const connection = DEFAULT_SETTINGS.externalConnections.find(({id}) =>
            id === 'pywalfox@frewacom.org'
        ) as ExternalConnection;

        let applyAt = 0;
        themeUpdate.mockImplementation(() => {
            applyAt = performance.now();
        });

        let microtaskRanAt = 0;
        queueMicrotask(() => {
            microtaskRanAt = performance.now();
        });

        Extension.externalRequestsHandler(makePayload(0), connection);

        // The apply happened synchronously inside the entry call: had the path
        // awaited anything, the microtask queued before the call would have run
        // before the theme API was reached.
        expect(applyAt).toBeGreaterThan(0);
        expect(microtaskRanAt).toBe(0);
        expect(themeUpdate).toHaveBeenCalledTimes(1);
    });
});
