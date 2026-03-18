export interface ConnectionProfile {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    authType: "password" | "keyboard-interactive" | "none";
    proxyUrl: string;
    createdAt: number;
    lastUsedAt: number;
}

export interface PluginSettings {
    defaultProxyUrl: string;
    fontFamily: string;
    fontSize: number;
    cursorStyle: "block" | "underline" | "bar";
    cursorBlink: boolean;
    scrollback: number;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    defaultProxyUrl: "",
    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
    fontSize: 14,
    cursorStyle: "block",
    cursorBlink: true,
    scrollback: 1000,
};

export const PROFILES_STORAGE = "ssh-profiles";
export const SETTINGS_STORAGE = "ssh-settings";
export const TAB_TYPE = "ssh-terminal";

export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export function buildWsUrl(profile: ConnectionProfile): string {
    return profile.proxyUrl
        .replace(/\{host\}/g, encodeURIComponent(profile.host))
        .replace(/\{port\}/g, String(profile.port))
        .replace(/\{username\}/g, encodeURIComponent(profile.username));
}
