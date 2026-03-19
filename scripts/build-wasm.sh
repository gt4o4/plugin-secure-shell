#!/bin/bash
# Build WASM OpenSSH binaries from the libapps/ssh_client source.
#
# Prerequisites:
#   - WASI SDK installed (https://github.com/WebAssembly/wasi-sdk)
#   - Binaryen installed (for wasm-opt)
#   - autoconf, mandoc, protobuf
#
# Usage:
#   ./scripts/build-wasm.sh
#
# Output:
#   wasm/ssh.wasm
#   wasm/sftp.wasm
#   wasm/ssh-keygen.wasm

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LIBAPPS_DIR="$ROOT_DIR/vendor/libapps"
OUTPUT_DIR="$ROOT_DIR/wasm"

# Check prerequisites
if [ ! -d "$LIBAPPS_DIR" ]; then
    echo "Error: vendor/libapps not found. Run: git submodule update --init"
    exit 1
fi

if [ -z "${WASI_SDK_PATH:-}" ]; then
    # Try common install locations
    for dir in /opt/wasi-sdk "$HOME/wasi-sdk" /usr/local/wasi-sdk; do
        if [ -d "$dir" ]; then
            WASI_SDK_PATH="$dir"
            break
        fi
    done
fi

if [ -z "${WASI_SDK_PATH:-}" ]; then
    echo "Error: WASI SDK not found. Set WASI_SDK_PATH or install to /opt/wasi-sdk"
    echo "Download from: https://github.com/WebAssembly/wasi-sdk/releases"
    exit 1
fi

echo "Using WASI SDK: $WASI_SDK_PATH"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Build using libapps' ssh_client build system
cd "$LIBAPPS_DIR/ssh_client"

# The libapps build uses these environment variables:
export WASI_SDK_PATH
export BUILD_DIR="$ROOT_DIR/.build/ssh_client"

mkdir -p "$BUILD_DIR"

# Build OpenSSH for WASM target
# This follows the same process as Chrome Secure Shell's CI
if [ -f "build.sh" ]; then
    echo "Building WASM OpenSSH via libapps build system..."
    bash build.sh
elif [ -f "Makefile" ]; then
    echo "Building WASM OpenSSH via Makefile..."
    make wasm
else
    echo "Error: No build system found in $LIBAPPS_DIR/ssh_client"
    echo ""
    echo "Manual build steps:"
    echo "  1. Install WASI SDK: https://github.com/WebAssembly/wasi-sdk/releases"
    echo "  2. Build dependencies (zlib, OpenSSL, ldns) for wasi-sdk target"
    echo "  3. Cross-compile OpenSSH with --host=wasm32-wasi"
    echo "  4. Run wasm-opt -O2 on output binaries"
    echo "  5. Copy ssh.wasm, sftp.wasm, ssh-keygen.wasm to $OUTPUT_DIR/"
    exit 1
fi

# Copy built WASM binaries to output directory
WASM_BINARIES=(ssh sftp ssh-keygen)
for bin in "${WASM_BINARIES[@]}"; do
    # Search for the built binary in common output locations
    for candidate in \
        "$BUILD_DIR/output/${bin}.wasm" \
        "$BUILD_DIR/${bin}.wasm" \
        "$LIBAPPS_DIR/ssh_client/output/${bin}.wasm" \
        "$LIBAPPS_DIR/ssh_client/build/${bin}.wasm"; do
        if [ -f "$candidate" ]; then
            echo "Copying ${bin}.wasm to $OUTPUT_DIR/"
            cp "$candidate" "$OUTPUT_DIR/${bin}.wasm"
            break
        fi
    done

    if [ ! -f "$OUTPUT_DIR/${bin}.wasm" ]; then
        echo "Warning: ${bin}.wasm not found in build output"
    fi
done

# Optimize with wasm-opt if available
if command -v wasm-opt &>/dev/null; then
    for wasm_file in "$OUTPUT_DIR"/*.wasm; do
        if [ -f "$wasm_file" ]; then
            echo "Optimizing $(basename "$wasm_file")..."
            wasm-opt -O2 "$wasm_file" -o "$wasm_file"
        fi
    done
else
    echo "Note: wasm-opt not found. Install Binaryen for optimized binaries."
fi

echo ""
echo "Build complete. WASM binaries in: $OUTPUT_DIR/"
ls -lh "$OUTPUT_DIR"/*.wasm 2>/dev/null || echo "No .wasm files found"
