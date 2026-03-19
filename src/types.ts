export interface ConnectionProfile {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    identityFile?: string;       // passed as ssh -i <path>
    extraArgs?: string;          // additional ssh args (e.g. "-v")
    portForwards?: string[];     // ["-L 8080:localhost:80", "-R 9090:localhost:3000"]
    createdAt: number;
    lastUsedAt: number;
}

export interface PluginSettings {
    fontFamily: string;
    fontSize: number;
    cursorStyle: "block" | "underline" | "bar";
    cursorBlink: boolean;
    scrollback: number;
    defaultIdentityFile: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
    fontSize: 14,
    cursorStyle: "block",
    cursorBlink: true,
    scrollback: 1000,
    defaultIdentityFile: "",
};

export const PROFILES_STORAGE = "ssh-profiles";
export const SETTINGS_STORAGE = "ssh-settings";
export const TAB_TYPE = "ssh-terminal";

export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
