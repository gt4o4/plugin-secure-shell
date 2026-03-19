// Ambient type declarations for vendor/libapps ES module JavaScript

declare module "*/hterm/index.js" {
    export const hterm: any;
}

declare module "*/libdot/index.js" {
    export const lib: any;
}

declare module "*/wasi-js-bindings/index.js" {
    export const WASI: {
        errno: {
            ESUCCESS: number;
            EBADF: number;
            EINVAL: number;
            ENOSYS: number;
            ENOTCONN: number;
            ECONNREFUSED: number;
            EHOSTUNREACH: number;
            ETIMEDOUT: number;
            EADDRINUSE: number;
            EAGAIN: number;
            EMFILE: number;
            EPROTONOSUPPORT: number;
            EROFS: number;
            ENOTDIR: number;
            ENOPROTOOPT: number;
            ENOTRECOVERABLE: number;
            [key: string]: number;
        };
        filetype: {
            UNKNOWN: number;
            REGULAR_FILE: number;
            DIRECTORY: number;
            CHARACTER_DEVICE: number;
            SOCKET_STREAM: number;
            SOCKET_DGRAM: number;
            [key: string]: number;
        };
        rights: {
            FD_READ: bigint;
            FD_WRITE: bigint;
            FD_SEEK: bigint;
            POLL_FD_READWRITE: bigint;
            SOCK_SHUTDOWN: bigint;
            [key: string]: bigint;
        };
        whence: {
            SET: number;
            CUR: number;
            END: number;
        };
        fdflags: {
            APPEND: number;
            DSYNC: number;
            NONBLOCK: number;
            RSYNC: number;
            SYNC: number;
        };
        oflags: {
            CREAT: number;
            DIRECTORY: number;
            EXCL: number;
            TRUNC: number;
        };
        signal: { [key: string]: number };
    };
    export const Process: {
        Background: new (workerUri: string, opts: any) => any;
        Foreground: new (...args: any[]) => any;
    };
    export const SyscallEntry: any;
    export const SyscallHandler: any;
    export const BackgroundWorker: any;
    export const util: any;
    export const WasiView: any;
}

declare module "*/wassh/js/syscall_handler.js" {
    export class RemoteReceiverWasiPreview1 {
        term_: any;
        vfs: {
            initStdio(handle: any): void;
            addHandler(handler: any): void;
            openHandle(handle: any): number;
            getFileHandle(fd: number): any;
            open(path: string, fdflags?: number, o_flags?: number): Promise<any>;
            close(fd: number): number;
        };
        process_: {
            send_signal(signum: number): void;
            writeTo(fd: number, buf: ArrayBuffer): Promise<any>;
        };
        notify_: (() => void) | null;
        fileSystem_: any;

        constructor(opts?: {
            term?: any;
            tcpSocketsOpen?: any;
            unixSocketsOpen?: any;
            secureInput?: any;
            fileSystem?: any;
        });
        init(): Promise<void>;
        handle_sock_create(domain: number, type: number, protocol: number): Promise<any>;
        handle_fd_write(fd: number, buf: ArrayBuffer): Promise<any>;
        getHandlers_(): any;
    }
}

declare module "*/wassh/js/vfs.js" {
    export class PathHandler {
        path: string;
        filetype: number;
        handleCls: any;
        constructor(path: string, filetype?: number, handleCls?: any);
        link(oldPath: string, newPath: string): Promise<number>;
        open(path: string, fdflags: number, o_flags: number): Promise<any>;
        rename(oldPath: string, newPath: string): Promise<number>;
        stat(): Promise<any>;
        unlink(path: string): Promise<number>;
    }

    export class PathHandle {
        path: string;
        pos: bigint;
        filetype: number;
        constructor(path: string, filetype?: number);
        init(): Promise<void>;
        close(): Promise<void>;
        write(buf: ArrayBufferView): Promise<any>;
        pwrite(buf: ArrayBufferView, offset: number | bigint): Promise<any>;
        read(length: number): Promise<any>;
        pread(length: number, offset: number | bigint): Promise<any>;
        tell(): any;
        seek(offset: number | bigint, whence: number): any;
        stat(): Promise<any>;
    }

    export class FileHandler extends PathHandler {}

    export class FileHandle extends PathHandle {
        data: Uint8Array;
        constructor(path: string, type?: number);
    }

    export class DirectoryHandler extends PathHandler {
        constructor(path: string, type?: number, handleCls?: any);
    }

    export class DirectoryHandle extends PathHandle {
        constructor(path: string);
    }

    export class CwdHandler extends DirectoryHandler {
        target: string;
        constructor(target: string);
    }

    export class DevNullHandler extends PathHandler {
        constructor(path?: string, filetype?: number, handleCls?: any);
    }

    export class DevNullHandle extends PathHandle {}

    export class VFS {
        constructor(opts: { trace?: boolean });
        initStdio(handle: any): void;
        addHandler(handler: PathHandler): void;
        getFileHandle(fd: number): PathHandle;
        openHandle(handle: PathHandle): number;
        open(path: string, fdflags?: number, o_flags?: number): Promise<any>;
        close(fd: number): number;
    }
}

declare module "*/wassh/js/sockets.js" {
    export class Socket {
        domain: number;
        protocol: number;
        address: string | null;
        port: number | null;
        receiveListener_: (() => void) | null;
        reader_: (() => void) | null;
        path: string;
        filetype: number;

        constructor(domain: number, type: number, protocol: number);
        connect(address: string, port: number): Promise<number>;
        onRecv(data: ArrayBuffer): void;
        write(buf: ArrayBufferView): Promise<any>;
        read(length: number, block?: boolean): Promise<any>;
        close(): Promise<void>;
        sendto(buf: ArrayBuffer, address: string, port: number): Promise<any>;
        setReceiveListener(listener: (() => void) | null): void;
        accept(): Promise<any>;
        bind(address: string, port: number): Promise<any>;
        listen(backlog: number): Promise<number>;
        getSocketOption(level: number, name: number): Promise<any>;
        setSocketOption(level: number, name: number, value: number): Promise<number>;
        getSocketInfo(): Promise<any>;
        stat(): Promise<any>;
        init(): Promise<void>;
    }

    export class StreamSocket extends Socket {
        data: Uint8Array;
        constructor(domain: number, type: number, protocol: number);
    }

    export class DatagramSocket extends Socket {
        data: Uint8Array[];
        constructor(domain: number, type: number, protocol: number);
    }
}

declare module "*/wassh/js/process.js" {
    export class Foreground {
        constructor(...args: any[]);
    }

    export class Background {
        signal_queue: number[];
        handler: any;
        worker: any;
        workerUri: string;

        constructor(workerUri: string, opts: {
            executable: string;
            argv: string[];
            environ: Record<string, string>;
            handler: any;
            sabSize?: number;
        });
        run(): Promise<any>;
        terminate(reason?: any): void;
        send_signal(signum: number): void;
        writeTo(fd: number, buf: ArrayBuffer): Promise<any>;
    }
}

declare module "*/wassh/js/constants.js" {
    export const AF_INET: number;
    export const AF_INET6: number;
}
