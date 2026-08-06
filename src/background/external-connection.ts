import type {ExternalConnection, ExternalRequest} from '../definitions';

const EXTERNAL_ACTIONS = new Set([
    'toggle',
    'toggleActiveTab',
    'changeSettings',
    'requestSettings',
    'setTheme',
    'setThemeVars',
    'resetSettings',
    'resetThemeVars',
    'error',
]);

export function parseExternalRequest(value: unknown): ExternalRequest | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const request = value as Partial<ExternalRequest>;
    if (typeof request.type !== 'string' || !EXTERNAL_ACTIONS.has(request.type)) {
        return null;
    }
    return request as ExternalRequest;
}

export function isExternalActionAllowed(connection: ExternalConnection, action: string): boolean {
    return EXTERNAL_ACTIONS.has(action) && !connection.blockedActions.includes(action);
}

export function resolveExternalConnection(
    connections: ExternalConnection[],
    identity: Pick<ExternalConnection, 'id' | 'isNative'>,
    action: string,
): ExternalConnection | null {
    const current = connections.find((connection) =>
        connection.id === identity.id && connection.isNative === identity.isNative
    );
    return current && isExternalActionAllowed(current, action) ? current : null;
}
