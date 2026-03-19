[中文](README_zh_CN.md)

# Secure Shell for SiYuan

A native SSH terminal plugin for [SiYuan](https://b3log.org/siyuan), powered by WASM OpenSSH and Chrome Secure Shell's terminal stack (hterm + wassh).

## Features

- Native SSH connections via WASM-compiled OpenSSH
- hterm terminal emulator (same as Chrome Secure Shell)
- Connection profile management with save/recall
- SSH key authentication (`-i` identity file)
- Port forwarding (`-L`, `-R`, `-D`)
- Custom SSH arguments
- Configurable font, cursor style, scrollback buffer

## Requirements

- SiYuan desktop app (Electron)
- SSH WASM binary (`ssh.wasm`) placed in `wasm/` directory

## Architecture

The plugin minimizes divergence from [Chrome Secure Shell](https://chromium.googlesource.com/apps/libapps) by reusing its upstream modules directly:

| Component | Source | Divergence |
|-----------|--------|-----------|
| hterm (terminal emulator) | vendor/libapps/hterm | 0% |
| libdot (utilities) | vendor/libapps/libdot | 0% |
| wasi-js-bindings (WASI runtime) | vendor/libapps/wasi-js-bindings | 0% |
| wassh (SSH WASI layer) | vendor/libapps/wassh | ~5% (subclassed) |

Custom code (in `src/wasm/`) provides only the Node.js-specific backends:

- **NodeSyscallHandler** — extends wassh's syscall handler, overrides socket creation and VFS initialization to use Node.js APIs instead of Chrome/IndexedDB APIs
- **NodeTcpSocket** — extends wassh's StreamSocket using Node.js `net` module
- **NodeFsDirectoryHandler** — extends wassh's DirectoryHandler using Node.js `fs` module
- **SshOrchestrator** — thin glue wiring hterm + wassh Process.Background + NodeSyscallHandler

## Development

```bash
pnpm i
pnpm run dev    # development build with watch mode
pnpm run build  # production build → package.zip
pnpm run lint   # ESLint with auto-fix
```

## License

MIT
