# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- `pnpm i` — install dependencies
- `pnpm run dev` — development build with webpack watch mode
- `pnpm run build` — production build, outputs `package.zip` for marketplace distribution
- `pnpm run lint` — ESLint with auto-fix (`eslint . --fix --cache`)

No test framework is configured.

## Architecture

This is a **SiYuan plugin** built on the [SiYuan](https://b3log.org/siyuan) plugin SDK. The plugin extends the `Plugin` base class from the `siyuan` npm package.

**Entry point:** `src/index.ts` — single file containing the plugin class with lifecycle methods (`onload`, `onLayoutReady`, `onunload`, `uninstall`).

**Build:** Webpack bundles TypeScript (via esbuild-loader) to CommonJS2. The `siyuan` package is marked as external. SCSS is compiled via sass-loader + MiniCssExtractPlugin. Production builds copy static assets (i18n, plugin.json, icons, READMEs) into `dist/` and package everything into `package.zip`.

**i18n:** Language files live in `src/i18n/` (e.g., `en_US.json`, `zh_CN.json`). Access translations in code via `this.i18n.key`. Plugins should support at least English and Simplified Chinese.

**Plugin metadata:** `plugin.json` at the repo root defines name, version, `minAppVersion`, supported backends/frontends, display names, and descriptions. Note: `displayName` and `description` fields are plain text (not HTML/Markdown).

## Key Constraints

- **File I/O must use the SiYuan kernel API** (`/api/file/*`). Do not use Node.js `fs` or Electron APIs — this causes data loss during sync and damages cloud data.
- **Daily notes** created manually (not via `/api/filetree/createDailyNote`) must have `custom-dailynote-yyyymmdd` attribute added to the document.
- **Frontend APIs:** https://github.com/siyuan-note/petal
- **Backend APIs:** https://github.com/siyuan-note/siyuan/blob/master/API.md
