// Bundler-compatible shim for libdot resources.
// Replaces vendor/libapps/libdot/js/deps_resources.shim.js to fix
// JSON named import issues with webpack 5 + "type": "module".

import pkg from "../../vendor/libapps/libdot/package.json";

export const gitDate = pkg.gitDate || "";
export const version = pkg.version || "";
