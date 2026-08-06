/**
 * Tracks the pywal vars signature the page last applied, so a repeated
 * UPDATE_THEME_VARS broadcast is a no-op per tab.
 *
 * The signature is only recorded when the dynamic theme actually exists (the
 * apply path in dynamic-theme/index.ts), and it is reset whenever the theme is
 * rebuilt or torn down — a full theme message may carry different colors, so a
 * stale signature must never suppress a later update.
 */
export class ThemeVarsSignatureTracker {
    private lastSignature: string | null = null;

    isDuplicate(signature: string | null | undefined): boolean {
        return typeof signature === 'string' && signature === this.lastSignature;
    }

    record(signature: string | null | undefined): void {
        this.lastSignature = signature ?? null;
    }

    reset(): void {
        this.lastSignature = null;
    }
}
