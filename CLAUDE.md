# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- `pnpm i` — install dependencies
- `pnpm run dev` — development build with webpack watch mode
- `pnpm run build` — production build, outputs `package.zip` for marketplace distribution
- `pnpm run lint` — ESLint with auto-fix (`eslint . --fix --cache`)

No test framework is configured.

## Architecture

This is a **SiYuan plugin** providing native SSH terminal functionality via WASM OpenSSH. It reuses Chrome Secure Shell's upstream modules (hterm, wassh, wasi-js-bindings) from `vendor/libapps/` as a git submodule, with zero modifications to vendor code (except one upstream bugfix in wassh/js/vfs.js).

**Entry point:** `src/index.ts` — plugin class with lifecycle methods, dialogs, settings panel.

**Terminal stack:**
- `src/terminal-session.ts` — creates hterm terminal, wires SshOrchestrator, handles reconnect
- `src/wasm/ssh-orchestrator.ts` — thin glue: creates NodeSyscallHandler + wassh Process.Background
- `src/wasm/node-syscall-handler.ts` — extends wassh's RemoteReceiverWasiPreview1, overrides init() (Node.js fs instead of IndexedDB) and handle_sock_create() (NodeTcpSocket instead of Chrome sockets)
- `src/wasm/node-socket.ts` — NodeTcpSocket extends wassh StreamSocket using Node.js `net` module
- `src/wasm/node-vfs.ts` — NodeFsDirectoryHandler extends wassh DirectoryHandler using Node.js `fs` module

**Build:** Webpack multi-config array:
1. **Worker bundle** (ESM) — bundles `vendor/libapps/wassh/js/worker.js` into `wassh-worker.js` for Web Worker
2. **Main bundle** (CommonJS2) — bundles plugin code + hterm + wassh syscall handler; `siyuan` is external

Resolve aliases redirect hterm/libdot resource imports to bundler-compatible shims in `src/shims/`. Asset loaders handle .ogg/.svg/.png/.html from vendor.

**i18n:** Language files in `src/i18n/` (en_US.json, zh_CN.json). Access via `this.i18n.key`.

**Plugin metadata:** `plugin.json` — name, version, supported backends/frontends (desktop only).

## Key Constraints

- **File I/O must use the SiYuan kernel API** (`/api/file/*`). Do not use Node.js `fs` or Electron APIs for SiYuan data — this causes data loss during sync. Exception: the SSH VFS (`node-vfs.ts`) uses Node.js `fs` for `~/.ssh/` files which are outside SiYuan's data directory.
- **Vendor code (`vendor/libapps/`)** should not be modified. Use resolve aliases, subclassing, or shims to adapt upstream code. The ESLint config ignores the `vendor` directory.
- **Frontend APIs:** https://github.com/siyuan-note/petal
- **Backend APIs:** https://github.com/siyuan-note/siyuan/blob/master/API.md
