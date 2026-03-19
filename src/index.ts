import {
    Plugin,
    showMessage,
    Dialog,
    Menu,
    openTab,
    getFrontend,
    Setting,
} from "siyuan";
import "./index.scss";
import {TerminalSession} from "./terminal-session";
import {
    ConnectionProfile,
    PluginSettings,
    DEFAULT_SETTINGS,
    PROFILES_STORAGE,
    SETTINGS_STORAGE,
    TAB_TYPE,
    generateId,
} from "./types";

const ICON_TERMINAL = "<symbol id=\"iconTerminal\" viewBox=\"0 0 1024 1024\"><path d=\"M64 128h896v768H64V128z m64 64v640h768V192H128z m128 480l192-192-192-192 64-64 256 256-256 256-64-64z m256 32h256v64H512v-64z\"/></symbol>";

export default class SecureShellPlugin extends Plugin {

    private sessions: Map<string, TerminalSession> = new Map();
    private profiles: ConnectionProfile[] = [];
    private settings: PluginSettings = {...DEFAULT_SETTINGS};

    async onload() {
        const frontEnd = getFrontend();
        const isDesktop = frontEnd === "desktop" || frontEnd === "desktop-window";

        this.addIcons(ICON_TERMINAL);

        this.addTab({
            type: TAB_TYPE,
            init() {
                if (!isDesktop) {
                    this.element.innerHTML = `<div class="secure-shell__terminal-container" style="display:flex;align-items:center;justify-content:center;color:#999;">${(this as any).i18n?.desktopOnly || "SSH terminal requires the SiYuan desktop app"}</div>`;
                    return;
                }

                const container = document.createElement("div");
                container.className = "secure-shell__terminal-container";
                this.element.appendChild(container);

                const data = this.data as {profile: ConnectionProfile; settings: PluginSettings; pluginDir: string};
                const session = new TerminalSession(container, data.profile, data.settings, data.pluginDir);
                session.init();
                session.connect();

                (this.element as any).__sshSession = session;
            },
            beforeDestroy() {
                const session = (this.element as any).__sshSession as TerminalSession | undefined;
                session?.dispose();
            },
            destroy() {
                delete (this.element as any).__sshSession;
            },
        });

        this.addCommand({
            langKey: "openTerminal",
            langText: this.i18n.openTerminal,
            hotkey: "⇧⌘T",
            callback: () => {
                this.showConnectDialog();
            },
        });

        this.setting = new Setting({
            confirmCallback: () => {
                this.saveSettings();
            },
        });
        this.buildSettingsPanel();
    }

    async onLayoutReady() {
        await this.loadProfiles();
        await this.loadSettings();
        this.buildSettingsPanel();

        this.addTopBar({
            icon: "iconTerminal",
            title: this.i18n.topBarTooltip,
            position: "right",
            callback: (event: MouseEvent) => {
                this.showMenu(event);
            },
        });
    }

    onunload() {
        this.sessions.forEach((session) => session.dispose());
        this.sessions.clear();
    }

    uninstall() {
        this.removeData(PROFILES_STORAGE);
        this.removeData(SETTINGS_STORAGE);
    }

    private showMenu(event: MouseEvent) {
        const menu = new Menu("secure-shell-menu");

        menu.addItem({
            icon: "iconAdd",
            label: this.i18n.newConnection,
            click: () => {
                this.showConnectDialog();
            },
        });

        menu.addItem({
            icon: "iconSettings",
            label: this.i18n.manageConnections,
            click: () => {
                this.showManageDialog();
            },
        });

        if (this.profiles.length > 0) {
            menu.addSeparator();

            const sorted = [...this.profiles].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
            for (const profile of sorted.slice(0, 10)) {
                menu.addItem({
                    label: profile.name || `${profile.username}@${profile.host}`,
                    click: () => {
                        this.openTerminalTab(profile);
                    },
                });
            }
        }

        menu.open({
            x: event.clientX,
            y: event.clientY,
            isLeft: true,
        });
    }

    private showConnectDialog() {
        const defaultIdentity = this.settings.defaultIdentityFile || "";
        const dialog = new Dialog({
            title: this.i18n.newConnection,
            content: `<div class="b3-dialog__content secure-shell__connect-form">
                <div class="b3-label">
                    <span>${this.i18n.profileName}</span>
                    <input type="text" class="b3-text-field fn__block" data-field="name" placeholder="${this.i18n.profileName}">
                </div>
                <div class="b3-label">
                    <span>${this.i18n.host}</span>
                    <input type="text" class="b3-text-field fn__block" data-field="host" placeholder="example.com">
                </div>
                <div class="b3-label">
                    <span>${this.i18n.port}</span>
                    <input type="number" class="b3-text-field fn__block" data-field="port" value="22" min="1" max="65535">
                </div>
                <div class="b3-label">
                    <span>${this.i18n.username}</span>
                    <input type="text" class="b3-text-field fn__block" data-field="username" placeholder="root">
                </div>
                <div class="b3-label">
                    <span>${this.i18n.identityFile}</span>
                    <input type="text" class="b3-text-field fn__block" data-field="identityFile" placeholder="~/.ssh/id_rsa" value="${this.escapeAttr(defaultIdentity)}">
                    <div class="b3-label__text">${this.i18n.identityFileHint}</div>
                </div>
                <div class="b3-label">
                    <span>${this.i18n.extraArgs}</span>
                    <input type="text" class="b3-text-field fn__block" data-field="extraArgs" placeholder="-v">
                    <div class="b3-label__text">${this.i18n.extraArgsHint}</div>
                </div>
                <div class="b3-label">
                    <span>${this.i18n.portForwards}</span>
                    <textarea class="b3-text-field fn__block" data-field="portForwards" rows="2" placeholder="-L 8080:localhost:80"></textarea>
                    <div class="b3-label__text">${this.i18n.portForwardsHint}</div>
                </div>
                <div class="b3-label">
                    <label class="fn__flex">
                        <input type="checkbox" class="b3-switch" data-field="saveProfile" checked>
                        <span class="fn__space"></span>
                        <span>${this.i18n.saveAsProfile}</span>
                    </label>
                </div>
            </div>
            <div class="b3-dialog__action">
                <button class="b3-button b3-button--cancel">${this.i18n.cancel}</button>
                <button class="b3-button b3-button--text">${this.i18n.connect}</button>
            </div>`,
            width: "520px",
        });

        const btns = dialog.element.querySelectorAll(".b3-button");
        btns[0].addEventListener("click", () => dialog.destroy());
        btns[1].addEventListener("click", () => {
            const getValue = (field: string) => {
                const el = dialog.element.querySelector(`[data-field="${field}"]`) as HTMLInputElement | HTMLTextAreaElement;
                return el?.value ?? "";
            };
            const getChecked = (field: string) => {
                const el = dialog.element.querySelector(`[data-field="${field}"]`) as HTMLInputElement;
                return el?.checked ?? false;
            };

            const portForwardsRaw = getValue("portForwards").trim();
            const portForwards = portForwardsRaw
                ? portForwardsRaw.split("\n").map((l) => l.trim()).filter(Boolean)
                : undefined;

            const profile: ConnectionProfile = {
                id: generateId(),
                name: getValue("name"),
                host: getValue("host"),
                port: parseInt(getValue("port")) || 22,
                username: getValue("username"),
                identityFile: getValue("identityFile") || undefined,
                extraArgs: getValue("extraArgs") || undefined,
                portForwards,
                createdAt: Date.now(),
                lastUsedAt: Date.now(),
            };

            if (!profile.host) {
                showMessage(this.i18n.hostRequired);
                return;
            }

            if (getChecked("saveProfile")) {
                this.profiles.push(profile);
                this.saveProfiles();
            }

            dialog.destroy();
            this.openTerminalTab(profile);
        });
    }

    private showManageDialog() {
        const buildList = () => {
            if (this.profiles.length === 0) {
                return `<div class="b3-dialog__content"><div class="b3-label">${this.i18n.noSavedProfiles}</div></div>`;
            }
            const items = this.profiles.map((p, i) => `
                <div class="secure-shell__profile-item" data-index="${i}">
                    <div class="secure-shell__profile-info">
                        <div class="secure-shell__profile-name">${this.escapeHtml(p.name || `${p.username}@${p.host}`)}</div>
                        <div class="secure-shell__profile-detail">${this.escapeHtml(p.host)}:${p.port}</div>
                    </div>
                    <div class="secure-shell__profile-actions">
                        <button class="b3-button b3-button--text b3-button--small" data-action="connect" data-index="${i}">${this.i18n.connect}</button>
                        <button class="b3-button b3-button--cancel b3-button--small" data-action="delete" data-index="${i}">${this.i18n.delete}</button>
                    </div>
                </div>
            `).join("");
            return `<div class="b3-dialog__content secure-shell__profile-list">${items}</div>`;
        };

        const dialog = new Dialog({
            title: this.i18n.manageConnections,
            content: buildList() + `<div class="b3-dialog__action">
                <button class="b3-button b3-button--cancel">${this.i18n.close}</button>
            </div>`,
            width: "520px",
        });

        dialog.element.addEventListener("click", (e) => {
            const target = (e.target as HTMLElement).closest("[data-action]") as HTMLElement;
            if (!target) return;

            const action = target.dataset.action;
            const index = parseInt(target.dataset.index || "0");
            const profile = this.profiles[index];
            if (!profile) return;

            if (action === "connect") {
                dialog.destroy();
                this.openTerminalTab(profile);
            } else if (action === "delete") {
                this.profiles.splice(index, 1);
                this.saveProfiles();
                const content = dialog.element.querySelector(".b3-dialog__content");
                if (content) {
                    content.outerHTML = buildList();
                }
            }
        });

        const closeBtn = dialog.element.querySelector(".b3-dialog__action .b3-button--cancel");
        closeBtn?.addEventListener("click", () => dialog.destroy());
    }

    private openTerminalTab(profile: ConnectionProfile) {
        profile.lastUsedAt = Date.now();
        const existingIdx = this.profiles.findIndex((p) => p.id === profile.id);
        if (existingIdx >= 0) {
            this.profiles[existingIdx] = profile;
            this.saveProfiles();
        }

        // Resolve plugin directory for WASM binary lookup
        // SiYuan plugins are located at: data/plugins/<plugin-name>/
        const pluginDir = `/plugins/${this.name}`;

        openTab({
            app: this.app,
            custom: {
                icon: "iconTerminal",
                title: profile.name || `${profile.username}@${profile.host}`,
                data: {profile, settings: this.settings, pluginDir},
                id: this.name + TAB_TYPE,
            },
        });
    }

    private buildSettingsPanel() {
        if (!this.setting) return;

        this.setting.addItem({
            title: this.i18n.settingsIdentityFile,
            description: this.i18n.settingsIdentityFileDesc,
            createActionElement: () => {
                const input = document.createElement("input");
                input.className = "b3-text-field fn__block";
                input.type = "text";
                input.value = this.settings.defaultIdentityFile;
                input.placeholder = "~/.ssh/id_rsa";
                input.addEventListener("input", () => {
                    this.settings.defaultIdentityFile = input.value;
                });
                return input;
            },
        });

        this.setting.addItem({
            title: this.i18n.settingsFontFamily,
            createActionElement: () => {
                const input = document.createElement("input");
                input.className = "b3-text-field fn__block";
                input.type = "text";
                input.value = this.settings.fontFamily;
                input.addEventListener("input", () => {
                    this.settings.fontFamily = input.value;
                });
                return input;
            },
        });

        this.setting.addItem({
            title: this.i18n.settingsFontSize,
            createActionElement: () => {
                const input = document.createElement("input");
                input.className = "b3-text-field";
                input.type = "number";
                input.min = "8";
                input.max = "32";
                input.value = String(this.settings.fontSize);
                input.addEventListener("input", () => {
                    this.settings.fontSize = parseInt(input.value) || 14;
                });
                return input;
            },
        });

        this.setting.addItem({
            title: this.i18n.settingsCursorStyle,
            createActionElement: () => {
                const select = document.createElement("select");
                select.className = "b3-select";
                select.innerHTML = `
                    <option value="block">${this.i18n.cursorBlock}</option>
                    <option value="underline">${this.i18n.cursorUnderline}</option>
                    <option value="bar">${this.i18n.cursorBar}</option>
                `;
                select.value = this.settings.cursorStyle;
                select.addEventListener("change", () => {
                    this.settings.cursorStyle = select.value as PluginSettings["cursorStyle"];
                });
                return select;
            },
        });

        this.setting.addItem({
            title: this.i18n.settingsCursorBlink,
            createActionElement: () => {
                const input = document.createElement("input");
                input.className = "b3-switch";
                input.type = "checkbox";
                input.checked = this.settings.cursorBlink;
                input.addEventListener("change", () => {
                    this.settings.cursorBlink = input.checked;
                });
                return input;
            },
        });

        this.setting.addItem({
            title: this.i18n.settingsScrollback,
            createActionElement: () => {
                const input = document.createElement("input");
                input.className = "b3-text-field";
                input.type = "number";
                input.min = "100";
                input.max = "100000";
                input.value = String(this.settings.scrollback);
                input.addEventListener("input", () => {
                    this.settings.scrollback = parseInt(input.value) || 1000;
                });
                return input;
            },
        });
    }

    private async loadProfiles() {
        const data = await this.loadData(PROFILES_STORAGE);
        if (Array.isArray(data)) {
            this.profiles = data;
        }
    }

    private async loadSettings() {
        const data = await this.loadData(SETTINGS_STORAGE);
        if (data && typeof data === "object") {
            this.settings = {...DEFAULT_SETTINGS, ...data};
        }
    }

    private saveProfiles() {
        this.saveData(PROFILES_STORAGE, this.profiles);
    }

    private saveSettings() {
        this.saveData(SETTINGS_STORAGE, this.settings);
    }

    private escapeHtml(str: string): string {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    private escapeAttr(str: string): string {
        return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
}
