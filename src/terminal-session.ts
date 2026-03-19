import {hterm} from "../vendor/libapps/hterm/index.js";
import {lib} from "../vendor/libapps/libdot/index.js";
import {ConnectionProfile, PluginSettings} from "./types";
import {SshOrchestrator} from "./wasm/ssh-orchestrator";

export type SessionState = "connecting" | "connected" | "disconnected" | "error";

const CURSOR_SHAPE_MAP: Record<string, string> = {
    "block": "BLOCK",
    "underline": "UNDERLINE",
    "bar": "BEAM",
};

export class TerminalSession {
    private terminal: any;  // hterm.Terminal
    private orchestrator: SshOrchestrator | null = null;
    private state: SessionState = "disconnected";
    private onStateChange: ((state: SessionState) => void) | null = null;
    private pluginDir: string;

    constructor(
        private container: HTMLElement,
        private profile: ConnectionProfile,
        private settings: PluginSettings,
        pluginDir: string,
    ) {
        this.pluginDir = pluginDir;
        this.terminal = new hterm.Terminal({
            storage: new lib.Storage.Memory(),
        });
    }

    init(): void {
        this.terminal.onTerminalReady = () => {
            this.terminal.installKeyboard();
            this.applySettings();
        };
        this.terminal.decorate(this.container);
    }

    private applySettings(): void {
        const prefs = this.terminal.prefs_;
        prefs.set("font-family", this.settings.fontFamily);
        prefs.set("font-size", this.settings.fontSize);
        prefs.set("cursor-blink", this.settings.cursorBlink);
        prefs.set("cursor-shape",
            CURSOR_SHAPE_MAP[this.settings.cursorStyle] || "BLOCK");
        prefs.set("scrollback-limit", this.settings.scrollback);
        // Use our environment's TERM value
        prefs.set("environment", {TERM: "xterm-256color"});
    }

    connect(): void {
        this.setState("connecting");

        const io = this.terminal.io.push();
        io.println(`Connecting to ${this.profile.username}@${this.profile.host}:${this.profile.port}...`);

        // Build SSH command arguments
        const argv = ["ssh"];
        argv.push("-o", "StrictHostKeyChecking=ask");
        argv.push("-p", String(this.profile.port));

        if (this.profile.identityFile) {
            argv.push("-i", this.profile.identityFile);
        }

        if (this.profile.portForwards) {
            for (const forward of this.profile.portForwards) {
                const parts = forward.trim().split(/\s+/);
                argv.push(...parts);
            }
        }

        if (this.profile.extraArgs) {
            const parts = this.profile.extraArgs.trim().split(/\s+/);
            argv.push(...parts);
        }

        argv.push(`${this.profile.username}@${this.profile.host}`);

        const environ: Record<string, string> = {
            HOME: "/",
            TERM: "xterm-256color",
            LANG: "en_US.UTF-8",
        };

        // Pop the temporary IO layer before the orchestrator sets up the Tty
        io.pop();

        this.orchestrator = new SshOrchestrator({
            terminal: this.terminal,
            pluginDir: this.pluginDir,
        });

        this.setState("connected");

        this.orchestrator.run(argv, environ).then((exitCode) => {
            this.setState("disconnected");
            this.showReconnectPrompt(
                `\x1b[33mConnection closed (exit code: ${exitCode}).\x1b[0m`);
        }).catch((err) => {
            this.setState("error");
            this.showReconnectPrompt(
                `\x1b[31mSSH error: ${err.message || err}\x1b[0m`);
        });
    }

    private showReconnectPrompt(message: string): void {
        // Push a new IO layer to intercept input for reconnect
        const io = this.terminal.io.push();
        io.println(message);
        io.println("Press Enter to reconnect.");
        io.onVTKeystroke = io.sendString = (str: string) => {
            if (str === "\r" || str === "\n") {
                io.pop();
                this.terminal.wipeContents();
                this.connect();
            }
        };
    }

    disconnect(): void {
        if (this.orchestrator) {
            this.orchestrator.terminate();
            this.orchestrator = null;
        }
        this.setState("disconnected");
    }

    dispose(): void {
        this.disconnect();
        this.terminal.uninstallKeyboard();
    }

    getState(): SessionState {
        return this.state;
    }

    setOnStateChange(cb: (state: SessionState) => void): void {
        this.onStateChange = cb;
    }

    private setState(state: SessionState): void {
        this.state = state;
        this.onStateChange?.(state);
    }
}
