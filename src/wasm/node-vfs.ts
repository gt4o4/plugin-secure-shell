/**
 * Node.js filesystem handler for wassh VFS.
 *
 * Replaces wassh's IndexeddbFsDirectoryHandler with one backed by Node.js `fs`,
 * so WASM OpenSSH can read/write real files (e.g. ~/.ssh/config, known_hosts).
 * Follows the same pattern as IndexeddbFsDirectoryHandler in wassh/js/vfs.js.
 */

import {WASI} from "../../vendor/libapps/wasi-js-bindings/index.js";
import {
    FileHandle, DirectoryHandler, DirectoryHandle, PathHandler,
} from "../../vendor/libapps/wassh/js/vfs.js";

const fs = window.require("fs") as typeof import("fs");
const nodePath = window.require("path") as typeof import("path");
const os = window.require("os") as typeof import("os");

/**
 * Maps a WASI virtual path to a real filesystem path.
 * WASM OpenSSH uses paths like /.ssh/config which we map to ~/.ssh/config.
 */
function resolveRealPath(virtualPath: string): string {
    const home = os.homedir();
    // /.ssh/foo → ~/.ssh/foo
    if (virtualPath.startsWith("/.ssh")) {
        return nodePath.join(home, virtualPath.substring(1));
    }
    // /home/user/.ssh/foo → ~/.ssh/foo
    if (virtualPath.startsWith("/home/")) {
        const parts = virtualPath.split("/");
        return nodePath.join(home, ...parts.slice(3));
    }
    return nodePath.join(home, virtualPath);
}

/**
 * File handle backed by Node.js fs.
 * Extends wassh's FileHandle — inherits in-memory buffer operations
 * (write, pwrite, read, pread, tell, seek, stat).
 * Only overrides init() to load from disk and close() to persist to disk.
 */
export class NodeFsFileHandle extends FileHandle {
    private realPath_: string;

    constructor(virtualPath: string) {
        super(virtualPath, WASI.filetype.REGULAR_FILE);
        this.realPath_ = resolveRealPath(virtualPath);
    }

    async init(): Promise<void> {
        try {
            const buf = fs.readFileSync(this.realPath_);
            this.data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        } catch {
            this.data = new Uint8Array(0);
        }
    }

    async close(): Promise<void> {
        try {
            const dir = nodePath.dirname(this.realPath_);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, {recursive: true});
            }
            fs.writeFileSync(this.realPath_, Buffer.from(this.data));
        } catch (e) {
            console.warn(`Failed to write ${this.realPath_}:`, e);
        }
    }
}

/**
 * Directory handler backed by Node.js fs.
 * Extends wassh's DirectoryHandler — follows the same pattern as
 * IndexeddbFsDirectoryHandler but uses Node.js fs for persistence.
 */
export class NodeFsDirectoryHandler extends DirectoryHandler {
    constructor(virtualPath: string) {
        super(virtualPath, WASI.filetype.DIRECTORY, DirectoryHandle);
    }

    async link(oldPath: string, newPath: string): Promise<number> {
        try {
            const realOld = resolveRealPath(oldPath);
            const realNew = resolveRealPath(newPath);
            fs.copyFileSync(realOld, realNew);
            return WASI.errno.ESUCCESS;
        } catch {
            return WASI.errno.ENOENT;
        }
    }

    async open(virtualPath: string, fdflags: number, o_flags: number): Promise<any> {
        if (virtualPath !== this.path) {
            const realPath = resolveRealPath(virtualPath);
            let exists = false;
            let isDir = false;

            try {
                const stat = fs.statSync(realPath);
                exists = true;
                isDir = stat.isDirectory();
            } catch { /* does not exist */ }

            if (o_flags & WASI.oflags.DIRECTORY) {
                if (!exists) return WASI.errno.ENOENT;
                if (!isDir) return WASI.errno.ENOTDIR;
            } else {
                if (exists && isDir) return WASI.errno.EISDIR;
            }

            let doTruncate = exists && !!(o_flags & WASI.oflags.TRUNC);

            if (o_flags & WASI.oflags.CREAT) {
                if (o_flags & WASI.oflags.EXCL) {
                    if (exists) return WASI.errno.EEXIST;
                }
                if (!exists) {
                    doTruncate = true;
                }
            } else {
                if (!exists) return WASI.errno.ENOENT;
            }

            if (doTruncate) {
                const dir = nodePath.dirname(realPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, {recursive: true});
                }
                fs.writeFileSync(realPath, "");
            }

            const handle = new NodeFsFileHandle(virtualPath);
            await handle.init();
            if (fdflags & WASI.fdflags.APPEND) {
                handle.seek(0, WASI.whence.END);
            }
            return handle;
        }
        return PathHandler.prototype.open.call(this, virtualPath, fdflags, o_flags);
    }

    async rename(oldPath: string, newPath: string): Promise<number> {
        try {
            const realOld = resolveRealPath(oldPath);
            const realNew = resolveRealPath(newPath);
            fs.renameSync(realOld, realNew);
            return WASI.errno.ESUCCESS;
        } catch {
            return WASI.errno.ENOENT;
        }
    }

    async stat(): Promise<any> {
        const realPath = resolveRealPath(this.path);
        try {
            const stat = fs.statSync(realPath);
            return {
                filetype: stat.isDirectory()
                    ? WASI.filetype.DIRECTORY
                    : WASI.filetype.REGULAR_FILE,
                size: BigInt(stat.size),
                atim: BigInt(Math.floor(stat.atimeMs)),
                mtim: BigInt(Math.floor(stat.mtimeMs)),
                ctim: BigInt(Math.floor(stat.ctimeMs)),
            };
        } catch {
            return {filetype: WASI.filetype.DIRECTORY};
        }
    }

    async unlink(virtualPath: string): Promise<number> {
        try {
            const realPath = resolveRealPath(virtualPath);
            fs.unlinkSync(realPath);
            return WASI.errno.ESUCCESS;
        } catch {
            return WASI.errno.ENOENT;
        }
    }
}
