#!/usr/bin/env bash
# Builds src/radar-wasm/radar.wasm from radar.c.
#
# The compiled .wasm is committed, so normal `npm run build` / Vercel deploys
# don't need this toolchain -- only rerun it after editing radar.c.
#
# Needs clang with the wasm32 target (Apple clang has it) and wasm-ld:
#   brew install lld
set -euo pipefail
cd "$(dirname "$0")/../src/radar-wasm"

clang --target=wasm32 -O3 -msimd128 -mbulk-memory -nostdlib \
  -Wall -Wextra \
  -Wl,--no-entry -Wl,--export=__heap_base -Wl,--strip-all \
  -o radar.wasm radar.c

echo "built $(pwd)/radar.wasm ($(wc -c < radar.wasm | tr -d ' ') bytes)"
