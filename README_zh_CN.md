[English](README.md)

# 思源笔记安全终端插件

基于 WASM OpenSSH 和 Chrome Secure Shell 终端技术栈（hterm + wassh）的 [思源笔记](https://b3log.org/siyuan) 原生 SSH 终端插件。

## 功能

- 通过 WASM 编译的 OpenSSH 实现原生 SSH 连接
- hterm 终端模拟器（与 Chrome Secure Shell 相同）
- 连接配置管理，支持保存和快速连接
- SSH 密钥认证（`-i` 指定密钥文件）
- 端口转发（`-L`、`-R`、`-D`）
- 自定义 SSH 参数
- 可配置字体、光标样式、滚动缓冲区

## 系统要求

- 思源笔记桌面版（Electron）
- SSH WASM 二进制文件（`ssh.wasm`）需放置在 `wasm/` 目录

## 架构

本插件通过直接复用 [Chrome Secure Shell](https://chromium.googlesource.com/apps/libapps) 的上游模块来最小化代码差异：

| 组件 | 来源 | 差异度 |
|------|------|--------|
| hterm（终端模拟器） | vendor/libapps/hterm | 0% |
| libdot（工具库） | vendor/libapps/libdot | 0% |
| wasi-js-bindings（WASI 运行时） | vendor/libapps/wasi-js-bindings | 0% |
| wassh（SSH WASI 层） | vendor/libapps/wassh | ~5%（通过继承扩展） |

自定义代码（位于 `src/wasm/`）仅提供 Node.js 特定的后端实现：

- **NodeSyscallHandler** — 继承 wassh 的系统调用处理器，覆写 socket 创建和 VFS 初始化以使用 Node.js API
- **NodeTcpSocket** — 继承 wassh 的 StreamSocket，使用 Node.js `net` 模块
- **NodeFsDirectoryHandler** — 继承 wassh 的 DirectoryHandler，使用 Node.js `fs` 模块
- **SshOrchestrator** — 轻量级胶水代码，连接 hterm + wassh Process.Background + NodeSyscallHandler

## 开发

```bash
pnpm i
pnpm run dev    # 开发构建（监听模式）
pnpm run build  # 生产构建 → package.zip
pnpm run lint   # ESLint 自动修复
```

## 许可证

MIT
