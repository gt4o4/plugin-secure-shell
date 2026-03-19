/**
 * SSH orchestrator — thin glue that wires together hterm, wassh runtime,
 * and our Node.js backends.
 *
 * Replaces both our custom SshProcess and nassh's WasmSubproc with the
 * minimal orchestration needed: create NodeSyscallHandler, spawn
 * Process.Background with the wassh worker, and run the WASM SSH binary.
 */

import {Background} from "../../vendor/libapps/wassh/js/process.js";
import {NodeSyscallHandler} from "./node-syscall-handler";

export class SshOrchestrator {
    private terminal: any;
    private pluginDir: string;
    private trace: boolean;
    private process_: InstanceType<typeof Background> | null = null;

    constructor(opts: {terminal: any; pluginDir: string; trace?: boolean}) {
        this.terminal = opts.terminal;
        this.pluginDir = opts.pluginDir;
        this.trace = opts.trace ?? false;
    }

    async run(argv: string[], environ: Record<string, string>): Promise<number> {
        // 1. Create our custom syscall handler
        const handler = new NodeSyscallHandler({
            term: this.terminal,
        });
        await handler.init();

        // 2. Resolve worker URL (bundled wassh-worker.js)
        const workerUrl = `${this.pluginDir}/wassh-worker.js` +
            (this.trace ? "?trace=true" : "");

        // 3. Resolve WASM binary path
        const wasmUrl = `${this.pluginDir}/wasm/ssh.wasm`;

        // 4. Create Process.Background
        this.process_ = new Background(workerUrl, {
            executable: wasmUrl,
            argv: [wasmUrl, ...argv.slice(1)],
            environ,
            handler,
            sabSize: 257 * 1024,
        });

        // 5. Run (blocks until exit)
        const result = await this.process_.run();
        this.process_ = null;
        return result?.status ?? 1;
    }

    terminate(): void {
        if (this.process_) {
            this.process_.terminate();
            this.process_ = null;
        }
    }
}
