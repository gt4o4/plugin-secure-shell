/**
 * Node.js WASI syscall handler for wassh.
 *
 * Extends wassh's RemoteReceiverWasiPreview1 with two overrides:
 * - init(): uses Node.js fs (via NodeFsDirectoryHandler) instead of IndexedDB
 * - handle_sock_create(): inserts NodeTcpSocket into the socket dispatch chain
 *
 * Also reimplements the unexported Tty class from wassh/js/syscall_handler.js,
 * which bridges hterm's IO interface to WASI stdin/stdout.
 */

import {WASI} from "../../vendor/libapps/wasi-js-bindings/index.js";
import {RemoteReceiverWasiPreview1} from "../../vendor/libapps/wassh/js/syscall_handler.js";
import {AF_INET, AF_INET6} from "../../vendor/libapps/wassh/js/constants.js";
import * as VFS from "../../vendor/libapps/wassh/js/vfs.js";
import {NodeTcpSocket} from "./node-socket";
import {NodeFsDirectoryHandler} from "./node-vfs";

/**
 * Tty — reimplements the unexported Tty class from syscall_handler.js (lines 21-81).
 * Extends VFS.FileHandle to provide stdin/stdout via hterm's IO interface.
 */
class NodeTty extends VFS.FileHandle {
    private term: any;
    private handler: any;

    constructor(term: any, handler: any) {
        super("/dev/tty", WASI.filetype.CHARACTER_DEVICE);
        this.term = term;
        this.handler = handler;
        // Wire keyboard input → onData_ buffer
        this.term.io.onVTKeystroke = this.term.io.sendString =
            this.onData_.bind(this);
    }

    stat(): any {
        return {
            fs_filetype: this.filetype,
            fs_rights_base: WASI.rights.FD_READ | WASI.rights.FD_WRITE,
        };
    }

    write(buf: Uint8Array): any {
        this.term.io.writeUTF8(buf);
        return {nwritten: buf.length};
    }

    async read(length: number): Promise<any> {
        const buf = Array.from(this.data.slice(0, length));
        this.data = this.data.subarray(length);
        return {buf};
    }

    private onData_(str: string): void {
        const te = new TextEncoder();
        const data = te.encode(str);
        const u8 = new Uint8Array(data);
        const newData = new Uint8Array(this.data.length + u8.length);
        newData.set(this.data);
        newData.set(u8, this.data.length);
        this.data = newData;
        if (this.handler.notify_) {
            this.handler.notify_();
        }
    }
}

/**
 * Node.js syscall handler extending wassh's RemoteReceiverWasiPreview1.
 *
 * Overrides init() to bypass IndexedDB dependencies and use Node.js fs.
 * Overrides handle_sock_create() to inject NodeTcpSocket for TCP streams.
 */
export class NodeSyscallHandler extends RemoteReceiverWasiPreview1 {
    constructor(opts: {
        term?: any;
        tcpSocketsOpen?: any;
        unixSocketsOpen?: any;
        secureInput?: any;
    } = {}) {
        super({...opts, fileSystem: null});
    }

    /**
     * Initialize the VFS with Node.js backends instead of IndexedDB.
     * Replicates parent init() (lines 104-127 of syscall_handler.js)
     * but replaces IndexeddbFsDirectoryHandler with NodeFsDirectoryHandler.
     */
    async init(): Promise<void> {
        // 1. Create Tty and init stdio (fds 0/1/2)
        const tty = new NodeTty(this.term_, this);
        this.vfs.initStdio(tty);

        // 2. Root directory
        const root = new VFS.DirectoryHandler("/");
        this.vfs.addHandler(root);
        await this.vfs.open("/");

        // 3. /.ssh via Node.js fs instead of IndexedDB
        const sshHandler = new NodeFsDirectoryHandler("/.ssh");
        this.vfs.addHandler(sshHandler);

        // 4. CWD
        const cwd = new VFS.CwdHandler("/");
        this.vfs.addHandler(cwd);
        await this.vfs.open(".");

        // 5. /dev/null
        this.vfs.addHandler(new VFS.DevNullHandler());

        // 6. Terminal resize → SIGWINCH
        this.term_.io.onTerminalResize = () => {
            // https://github.com/WebAssembly/wasi-libc/issues/272
            this.process_.send_signal(28 /* musl SIGWINCH */);
        };
    }

    /**
     * Create a socket, inserting NodeTcpSocket for TCP streams.
     * Falls through to parent for other socket types.
     */
    async handle_sock_create(
        domain: number, type: number, protocol: number
    ): Promise<any> {
        if ((domain === AF_INET || domain === AF_INET6) &&
            type === WASI.filetype.SOCKET_STREAM &&
            NodeTcpSocket.isSupported()) {
            const handle = new NodeTcpSocket(domain, type, protocol);
            handle.setReceiveListener(() => {
                if (this.notify_) this.notify_();
            });
            if (await handle.init() === false) {
                return WASI.errno.ENOSYS;
            }
            const socket = this.vfs.openHandle(handle);
            if (socket < 0) {
                await handle.close();
                return WASI.errno.EMFILE;
            }
            return {socket};
        }
        return super.handle_sock_create(domain, type, protocol);
    }
}
