/**
 * Node.js TCP socket backend for wassh.
 *
 * Extends wassh's StreamSocket to integrate with Node.js `net` module
 * via Electron's window.require(). Follows the same pattern as
 * ChromeTcpSocket / ChromeTcpListenSocket in wassh/js/sockets.js.
 */

import {WASI} from "../../vendor/libapps/wasi-js-bindings/index.js";
import {StreamSocket} from "../../vendor/libapps/wassh/js/sockets.js";

const net = window.require("net") as typeof import("net");

// Socket option constants (matching wassh/js/sockets.js)
const SOL_SOCKET = 0x7fffffff;
const SO_ERROR = 4;
const SO_KEEPALIVE = 9;
const IPPROTO_TCP = 6;
const TCP_NODELAY = 1;

/**
 * Node.js TCP stream socket extending wassh's StreamSocket.
 *
 * Inherits buffered receive (onRecv/read), setReceiveListener, stat,
 * bind/listen/accept stubs from the parent. Overrides connect, write,
 * close, getSocketInfo, getSocketOption, setSocketOption.
 */
export class NodeTcpSocket extends StreamSocket {
    private socket_: ReturnType<typeof net.createConnection> | null = null;
    private tcpKeepAlive_ = false;
    private tcpNoDelay_ = false;
    private localAddress_ = "";
    private localPort_ = 0;
    private connected_ = false;
    private error_: number | null = null;

    static isSupported(): boolean {
        try {
            return typeof window.require === "function" && !!window.require("net");
        } catch {
            return false;
        }
    }

    async connect(address: string, port: number): Promise<number> {
        if (this.address !== null) {
            return WASI.errno.EISCONN;
        }

        return new Promise<number>((resolve) => {
            this.socket_ = net.createConnection({host: address, port}, () => {
                this.address = address;
                this.port = port;
                this.connected_ = true;
                if (this.socket_) {
                    this.localAddress_ = this.socket_.localAddress || "";
                    this.localPort_ = this.socket_.localPort || 0;
                }
                resolve(WASI.errno.ESUCCESS);
            });

            this.socket_.on("data", (chunk: Buffer) => {
                // Convert Node.js Buffer to ArrayBuffer for parent's onRecv
                const ab = chunk.buffer.slice(
                    chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
                this.onRecv(ab);
            });

            this.socket_.on("error", (err: NodeJS.ErrnoException) => {
                if (!this.connected_) {
                    if (err.code === "ECONNREFUSED") {
                        resolve(WASI.errno.ECONNREFUSED);
                    } else if (err.code === "ETIMEDOUT") {
                        resolve(WASI.errno.ETIMEDOUT);
                    } else if (err.code === "EHOSTUNREACH") {
                        resolve(WASI.errno.EHOSTUNREACH);
                    } else {
                        resolve(WASI.errno.ENOTRECOVERABLE);
                    }
                } else {
                    this.error_ = WASI.errno.ENOTRECOVERABLE;
                }
            });

            this.socket_.on("close", () => {
                this.connected_ = false;
                // Wake up any blocked reader to signal EOF
                if (this.reader_) {
                    this.reader_();
                    this.reader_ = null;
                }
                if (this.receiveListener_) {
                    this.receiveListener_();
                }
            });
        });
    }

    async write(buf: Uint8Array): Promise<number | {nwritten: number}> {
        if (!this.socket_ || !this.connected_) {
            return WASI.errno.EBADF;
        }

        return new Promise((resolve) => {
            this.socket_!.write(Buffer.from(buf), (err) => {
                if (err) {
                    resolve(WASI.errno.ENOTRECOVERABLE);
                } else {
                    resolve({nwritten: buf.length});
                }
            });
        });
    }

    async close(): Promise<void> {
        if (this.socket_) {
            this.socket_.removeAllListeners();
            this.socket_.destroy();
            this.socket_ = null;
        }
        this.address = null;
        this.port = null;
        this.connected_ = false;
    }

    async getSocketInfo(): Promise<any> {
        return {
            connected: this.connected_,
            peerAddress: this.address || "0.0.0.0",
            peerPort: this.port || 0,
            localAddress: this.localAddress_ || "0.0.0.0",
            localPort: this.localPort_ || 0,
        };
    }

    async getSocketOption(level: number, name: number): Promise<number | {option: number}> {
        switch (level) {
        case SOL_SOCKET:
            switch (name) {
            case SO_ERROR:
                return {option: this.error_ || 0};
            case SO_KEEPALIVE:
                return {option: this.tcpKeepAlive_ ? 1 : 0};
            }
            break;
        case IPPROTO_TCP:
            switch (name) {
            case TCP_NODELAY:
                return {option: this.tcpNoDelay_ ? 1 : 0};
            }
            break;
        }
        return WASI.errno.ENOPROTOOPT;
    }

    async setSocketOption(level: number, name: number, value: number): Promise<number> {
        switch (level) {
        case SOL_SOCKET:
            switch (name) {
            case SO_KEEPALIVE:
                this.tcpKeepAlive_ = !!value;
                this.socket_?.setKeepAlive(!!value);
                return WASI.errno.ESUCCESS;
            }
            break;
        case IPPROTO_TCP:
            switch (name) {
            case TCP_NODELAY:
                this.tcpNoDelay_ = !!value;
                this.socket_?.setNoDelay(!!value);
                return WASI.errno.ESUCCESS;
            }
            break;
        }
        return WASI.errno.ENOPROTOOPT;
    }
}

/**
 * Node.js TCP listen socket for remote port forwarding.
 * Follows the ChromeTcpListenSocket pattern from wassh/js/sockets.js.
 */
export class NodeTcpListenSocket extends StreamSocket {
    private server_: ReturnType<typeof net.createServer> | null = null;
    private clients_: NodeTcpSocket[] = [];

    async bind(address: string, port: number): Promise<number | NodeTcpListenSocket> {
        return new Promise((resolve) => {
            this.server_ = net.createServer((socket) => {
                const client = new NodeTcpSocket(
                    this.domain, this.filetype, this.protocol);
                (client as any).socket_ = socket;
                client.address = socket.remoteAddress || "";
                client.port = socket.remotePort || 0;
                (client as any).connected_ = true;

                socket.on("data", (chunk: Buffer) => {
                    const ab = chunk.buffer.slice(
                        chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
                    client.onRecv(ab);
                });

                socket.on("close", () => {
                    (client as any).connected_ = false;
                });

                this.clients_.push(client);
                if (this.receiveListener_) {
                    this.receiveListener_();
                }
            });

            this.server_.listen(port, address, () => {
                this.address = address;
                this.port = port;
                resolve(this);
            });

            this.server_.on("error", () => {
                resolve(WASI.errno.EADDRINUSE);
            });
        });
    }

    async listen(): Promise<number> {
        return WASI.errno.ESUCCESS;
    }

    async accept(): Promise<number | NodeTcpSocket> {
        if (this.clients_.length > 0) {
            return this.clients_.shift()!;
        }

        await new Promise<void>((resolve) => {
            const orig = this.receiveListener_;
            this.receiveListener_ = () => {
                this.receiveListener_ = orig;
                resolve();
            };
        });

        if (this.clients_.length > 0) {
            return this.clients_.shift()!;
        }

        return WASI.errno.EAGAIN;
    }

    async close(): Promise<void> {
        if (this.server_) {
            this.server_.close();
            this.server_ = null;
        }
        for (const client of this.clients_) {
            await client.close();
        }
        this.clients_ = [];
    }

    async getSocketInfo(): Promise<any> {
        return {
            connected: !!this.server_,
            localAddress: this.address || "0.0.0.0",
            localPort: this.port || 0,
        };
    }
}
