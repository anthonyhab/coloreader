import {DEFAULT_SETTINGS} from '../../src/defaults';
import {isExternalActionAllowed, parseExternalRequest, resolveExternalConnection} from '../../src/background/external-connection';
import {
    getEffectivePywalThemeVars,
    getPywalThemePatch,
    getPywalThemeVarsSignature,
    isDuplicatePywalThemeVars,
    resetPywalThemeShadow,
    updatePywalThemeShadow,
    validatePywalThemeMode,
    validatePywalThemeVars,
} from '../../src/background/pywal-theme';

describe('native pywal fast path', () => {
    test('validates dark, light, generic, and mode messages at the boundary', () => {
        expect(validatePywalThemeVars({
            darkSchemeBackgroundColor: '#102030',
            darkSchemeTextColor: '#f0e0d0',
            selectionColor: '#405060',
        })).toEqual({bg: '#102030', fg: '#f0e0d0', sel: '#405060', scheme: 'dark'});
        expect(validatePywalThemeVars({
            lightSchemeBackgroundColor: '#f0e0d0',
            lightSchemeTextColor: '#102030',
            selectionColor: '#405060',
        })).toEqual({bg: '#f0e0d0', fg: '#102030', sel: '#405060', scheme: 'light'});
        expect(validatePywalThemeVars({
            bg: '#102030',
            fg: '#f0e0d0',
            scheme: 'light',
        })).toEqual({bg: '#102030', fg: '#f0e0d0', scheme: 'light'});
        expect(validatePywalThemeVars({bg: 'red', fg: '#ffffff'})).toBeNull();
        expect(validatePywalThemeVars({bg: '#000000', fg: '<style>'})).toBeNull();
        expect(validatePywalThemeVars({
            darkSchemeBackgroundColor: '#000000',
            darkSchemeTextColor: '#ffffff',
            lightSchemeBackgroundColor: '#ffffff',
            lightSchemeTextColor: '#000000',
        })).toBeNull();
        expect(validatePywalThemeMode({mode: 0})).toBe(0);
        expect(validatePywalThemeMode({mode: 1})).toBe(1);
        expect(validatePywalThemeMode({mode: 2})).toBeNull();
    });

    test('uses current selection color when omitted and patches the matching pole', () => {
        const theme = {...DEFAULT_SETTINGS.theme, selectionColor: '#abcdef'};
        const vars = getEffectivePywalThemeVars({
            bg: '#102030',
            fg: '#f0e0d0',
            scheme: 'light',
        }, theme);
        expect(vars).toEqual({
            bg: '#102030',
            fg: '#f0e0d0',
            sel: '#abcdef',
            scheme: 'light',
        });
        expect(getPywalThemePatch(vars)).toEqual({
            lightSchemeBackgroundColor: '#102030',
            lightSchemeTextColor: '#f0e0d0',
            selectionColor: '#abcdef',
        });
    });

    test('authorizes only configured, unblocked external actions', () => {
        const pywal = DEFAULT_SETTINGS.externalConnections.find(({id}) =>
            id === 'pywalfox@frewacom.org'
        )!;
        expect(parseExternalRequest({type: 'setTheme', data: {}})?.type).toBe('setTheme');
        expect(parseExternalRequest({type: 'executeScript'})).toBeNull();
        expect(parseExternalRequest('setTheme')).toBeNull();
        expect(isExternalActionAllowed(pywal, 'setTheme')).toBe(true);
        expect(isExternalActionAllowed(pywal, 'changeSettings')).toBe(false);
        expect(isExternalActionAllowed(pywal, 'executeScript')).toBe(false);
        expect(resolveExternalConnection([pywal], pywal, 'setTheme')).toBe(pywal);
        expect(resolveExternalConnection([], pywal, 'setTheme')).toBeNull();
        expect(resolveExternalConnection(
            [{...pywal, blockedActions: [...pywal.blockedActions, 'setTheme']}],
            pywal,
            'setTheme',
        )).toBeNull();
    });

    test('deduplicates only the matching scheme and effective settings', () => {
        const vars = {bg: '#102030', fg: '#f0e0d0', sel: '#405060', scheme: 'dark' as const};
        const theme = {
            ...DEFAULT_SETTINGS.theme,
            darkSchemeBackgroundColor: vars.bg,
            darkSchemeTextColor: vars.fg,
            selectionColor: vars.sel,
        };
        const signature = getPywalThemeVarsSignature(vars);

        expect(isDuplicatePywalThemeVars(vars, theme, signature)).toBe(true);
        expect(isDuplicatePywalThemeVars(vars, theme, null)).toBe(false);
        expect(isDuplicatePywalThemeVars(vars, {...theme, darkSchemeTextColor: '#ffffff'}, signature)).toBe(false);
        expect(isDuplicatePywalThemeVars({...vars, scheme: 'light'}, theme, signature)).toBe(false);
    });

    test('persists the original theme across restart and restores all controlled fields', () => {
        const origin = 'pywalfox@bb.hab.rip';
        const originalTheme = {
            ...DEFAULT_SETTINGS.theme,
            mode: 1 as const,
            darkSchemeBackgroundColor: '#111111',
            darkSchemeTextColor: '#eeeeee',
            lightSchemeBackgroundColor: '#fafafa',
            lightSchemeTextColor: '#202020',
            selectionColor: '#336699',
        };
        const darkPatch = {
            darkSchemeBackgroundColor: '#010203',
            darkSchemeTextColor: '#f1f2f3',
            selectionColor: '#abcdef',
        };
        let shadowCopy = updatePywalThemeShadow([], origin, originalTheme, darkPatch);

        // A JSON round trip models a background/browser restart.
        shadowCopy = JSON.parse(JSON.stringify(shadowCopy));
        const afterDark = {...originalTheme, ...darkPatch};
        const lightAndModePatch = {
            lightSchemeBackgroundColor: '#e0e1e2',
            lightSchemeTextColor: '#101112',
            mode: 0 as const,
        };
        shadowCopy = updatePywalThemeShadow(
            shadowCopy,
            origin,
            afterDark,
            lightAndModePatch,
        );
        const currentSettings = {
            ...DEFAULT_SETTINGS,
            theme: {...afterDark, ...lightAndModePatch},
            shadowCopy,
        };
        const reset = resetPywalThemeShadow(shadowCopy, origin, currentSettings)!;

        expect(reset.previousSettings.theme).toMatchObject({
            mode: 1,
            darkSchemeBackgroundColor: '#111111',
            darkSchemeTextColor: '#eeeeee',
            lightSchemeBackgroundColor: '#fafafa',
            lightSchemeTextColor: '#202020',
            selectionColor: '#336699',
        });
        expect(reset.shadowCopy).toEqual([]);
    });
});
