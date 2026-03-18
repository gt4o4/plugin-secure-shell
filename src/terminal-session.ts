import {Terminal} from "@xterm/xterm";
import {FitAddon} from "@xterm/addon-fit";
import {WebLinksAddon} from "@xterm/addon-web-links";
import {SearchAddon} from "@xterm/addon-search";
import {WebglAddon} from "@xterm/addon-webgl";
import {ConnectionProfile, PluginSettings, buildWsUrl} from "./types";

export type SessionState = "connecting" | "connected" | "disconnected" | "error";

export class TerminalSession {
    readonly terminal: Terminal;
    private fitAddon: FitAddon;
    private searchAddon: SearchAddon;
    private webglAddon: WebglAddon | null = null;
    private socket: WebSocket | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private state: SessionState = "disconnected";
    private onStateChange: ((state: SessionState) => void) | null = null;

    constructor(
        private container: HTMLElement,
        private profile: ConnectionProfile,
        private settings: PluginSettings,
    ) {
        this.terminal = new Terminal({
            fontFamily: settings.fontFamily,
            fontSize: settings.fontSize,
            cursorStyle: settings.cursorStyle,
            cursorBlink: settings.cursorBlink,
            scrollback: settings.scrollback,
            allowProposedApi: true,
        });

        this.fitAddon = new FitAddon();
        this.searchAddon = new SearchAddon();

        this.terminal.loadAddon(this.fitAddon);
        this.terminal.loadAddon(this.searchAddon);
        this.terminal.loadAddon(new WebLinksAddon());
    }

    init(): void {
        this.terminal.open(this.container);

        try {
            this.webglAddon = new WebglAddon();
            this.webglAddon.onContextLoss(() => {
                this.webglAddon?.dispose();
                this.webglAddon = null;
            });
            this.terminal.loadAddon(this.webglAddon);
        } catch {
            // Canvas renderer fallback
        }

        this.fitAddon.fit();

        this.resizeObserver = new ResizeObserver(() => {
            this.fit();
        });
        this.resizeObserver.observe(this.container);
    }

    connect(password?: string): void {
        const url = buildWsUrl(this.profile);
        if (!url) {
            this.terminal.writeln("\x1b[31mNo WebSocket proxy URL configured.\x1b[0m");
            this.terminal.writeln("Please set a proxy URL in the plugin settings or connection profile.");
            return;
        }

        this.setState("connecting");
        this.terminal.writeln(`Connecting to ${this.profile.username}@${this.profile.host}:${this.profile.port}...`);

        this.socket = new WebSocket(url);
        this.socket.binaryType = "arraybuffer";

        this.socket.onopen = () => {
            this.setState("connected");
            if (password && this.profile.authType === "password") {
                this.socket?.send(JSON.stringify({
                    type: "auth",
                    username: this.profile.username,
                    password,
                }));
            }
        };

        this.socket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                this.terminal.write(new Uint8Array(event.data));
            } else {
                this.terminal.write(event.data);
            }
        };

        this.socket.onerror = () => {
            this.setState("error");
            this.terminal.writeln("\r\n\x1b[31mConnection error.\x1b[0m");
        };

        this.socket.onclose = (event) => {
            this.setState("disconnected");
            this.terminal.writeln(`\r\n\x1b[33mConnection closed (code: ${event.code}).\x1b[0m`);
            this.terminal.writeln("Press Enter to reconnect.");
            this.setupReconnect();
        };

        this.terminal.onData((data) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(data);
            }
        });

        this.terminal.onBinary((data) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                const buffer = new Uint8Array(data.length);
                for (let i = 0; i < data.length; i++) {
                    buffer[i] = data.charCodeAt(i) & 0xFF;
                }
                this.socket.send(buffer.buffer);
            }
        });

        this.terminal.onResize((dims) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: "resize",
                    cols: dims.cols,
                    rows: dims.rows,
                }));
            }
        });
    }

    private setupReconnect(): void {
        const disposable = this.terminal.onData((data) => {
            if (data === "\r" || data === "\n") {
                disposable.dispose();
                this.terminal.clear();
                this.connect();
            }
        });
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.onclose = null;
            this.socket.close();
            this.socket = null;
        }
        this.setState("disconnected");
    }

    dispose(): void {
        this.disconnect();
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.webglAddon?.dispose();
        this.searchAddon.dispose();
        this.fitAddon.dispose();
        this.terminal.dispose();
    }

    fit(): void {
        try {
            this.fitAddon.fit();
        } catch {
            // Ignore fit errors when container not visible
        }
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
