import type {ShadowCopy, Theme, UserSettings} from '../definitions';
import {getPreviousObject} from '../utils/object';

export type PywalThemeScheme = 'dark' | 'light';

export interface PywalThemeVars {
    bg: string;
    fg: string;
    sel?: string;
    scheme: PywalThemeScheme;
}

export interface EffectivePywalThemeVars {
    bg: string;
    fg: string;
    sel: string;
    scheme: PywalThemeScheme;
}

function isHexColor(value: unknown): value is string {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function validatePywalThemeVars(data: Record<string, unknown>): PywalThemeVars | null {
    const hasGeneric = data.bg != null || data.fg != null;
    const hasDark = data.darkSchemeBackgroundColor != null || data.darkSchemeTextColor != null;
    const hasLight = data.lightSchemeBackgroundColor != null || data.lightSchemeTextColor != null;
    const specifiedSchemes = Number(hasGeneric) + Number(hasDark) + Number(hasLight);
    if (specifiedSchemes !== 1) {
        return null;
    }

    let bg: unknown;
    let fg: unknown;
    let scheme: PywalThemeScheme;
    if (hasLight) {
        bg = data.lightSchemeBackgroundColor;
        fg = data.lightSchemeTextColor;
        scheme = 'light';
    } else if (hasDark) {
        bg = data.darkSchemeBackgroundColor;
        fg = data.darkSchemeTextColor;
        scheme = 'dark';
    } else {
        bg = data.bg;
        fg = data.fg;
        scheme = data.scheme === 'light' ? 'light' : 'dark';
        if (data.scheme != null && data.scheme !== 'dark' && data.scheme !== 'light') {
            return null;
        }
    }

    const sel = data.sel ?? data.selectionColor;
    if (!isHexColor(bg) || !isHexColor(fg)) {
        return null;
    }
    if (sel != null && sel !== 'auto' && !isHexColor(sel)) {
        return null;
    }
    return {bg, fg, ...(typeof sel === 'string' ? {sel} : {}), scheme};
}

export function validatePywalThemeMode(data: Record<string, unknown>): 0 | 1 | null {
    return data.mode === 0 || data.mode === 1 ? data.mode : null;
}

export function getEffectivePywalThemeVars(
    vars: PywalThemeVars,
    currentTheme: Theme,
): EffectivePywalThemeVars {
    return {
        ...vars,
        sel: vars.sel ?? currentTheme.selectionColor,
    };
}

export function getPywalThemePatch(vars: EffectivePywalThemeVars): Partial<Theme> {
    const colorPatch = vars.scheme === 'dark' ? {
        darkSchemeBackgroundColor: vars.bg,
        darkSchemeTextColor: vars.fg,
    } : {
        lightSchemeBackgroundColor: vars.bg,
        lightSchemeTextColor: vars.fg,
    };
    return {...colorPatch, selectionColor: vars.sel};
}

export function updatePywalThemeShadow(
    shadowCopies: ShadowCopy[],
    origin: string,
    currentTheme: Theme,
    patch: Partial<Theme>,
): ShadowCopy[] {
    const result = shadowCopies.slice();
    const index = result.findIndex(({id}) => id === origin);
    const existing = index >= 0 ? result[index] : null;
    const shadowCopy: ShadowCopy = {
        id: origin,
        copy: {
            ...(existing?.copy || {}),
            theme: {
                ...((existing?.copy.theme || {}) as Partial<Theme>),
                ...patch,
            } as Theme,
        },
        oldSettings: existing?.oldSettings || {
            theme: {...currentTheme},
        } as Partial<UserSettings>,
    };
    if (index >= 0) {
        result[index] = shadowCopy;
    } else {
        result.push(shadowCopy);
    }
    return result;
}

export function resetPywalThemeShadow(
    shadowCopies: ShadowCopy[],
    origin: string,
    currentSettings: UserSettings,
): {previousSettings: Partial<UserSettings>; shadowCopy: ShadowCopy[]} | null {
    const entry = shadowCopies.find(({id}) => id === origin);
    if (!entry) {
        return null;
    }
    return {
        previousSettings: getPreviousObject(entry.copy, currentSettings, entry.oldSettings),
        shadowCopy: shadowCopies.filter(({id}) => id !== origin),
    };
}

export function getPywalThemeVarsSignature(vars: EffectivePywalThemeVars): string {
    return `${vars.scheme}\u0000${vars.bg}\u0000${vars.fg}\u0000${vars.sel}`;
}

export function isDuplicatePywalThemeVars(
    vars: EffectivePywalThemeVars,
    currentTheme: Theme,
    lastSignature: string | null,
): boolean {
    const colorsMatch = vars.scheme === 'dark' ?
        currentTheme.darkSchemeBackgroundColor === vars.bg &&
            currentTheme.darkSchemeTextColor === vars.fg :
        currentTheme.lightSchemeBackgroundColor === vars.bg &&
            currentTheme.lightSchemeTextColor === vars.fg;
    return lastSignature === getPywalThemeVarsSignature(vars) &&
        colorsMatch && currentTheme.selectionColor === vars.sel;
}
