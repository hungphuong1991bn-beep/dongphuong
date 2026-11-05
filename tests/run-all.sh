#!/usr/bin/env bash
# Chạy toàn bộ kiểm thử: so BẢN GỐC (tag baseline-v2.5.141) với bản hiện tại.
# Yêu cầu: node ≥ 18, `npm i` trong thư mục tests/ (playwright + acorn), python3 + pillow + numpy.
set -e; cd "$(dirname "$0")/.."; ROOT=$PWD; TMP=${TMPDIR:-/tmp}/sx-refactor-test; rm -rf "$TMP"; mkdir -p "$TMP"
git worktree add -f "$TMP/baseline" baseline-v2.5.141 >/dev/null 2>&1 || git --work-tree="$TMP/baseline" checkout baseline-v2.5.141 -- . 
export NODE_PATH="${NODE_PATH:-$ROOT/tests/node_modules}"; export ACORN_PATH="${ACORN_PATH:-$ROOT/tests/node_modules/acorn}"
echo "== 1. Kiểm chứng tĩnh =="; node tests/static/verify-sw.js; node tools/refactor/verify.js "$TMP/baseline/index.html" "$ROOT"
echo "== 2. Giao diện (DOM/CSS/ảnh) =="; node tests/e2e/capture.js "$TMP/baseline" "$TMP/cap_base"; node tests/e2e/capture.js "$ROOT" "$TMP/cap_new"; python3 tests/e2e/compare.py "$TMP/cap_base" "$TMP/cap_new" --px-tol 0.1
echo "== 3. Chức năng/đồng bộ =="; node tests/e2e/functional.js "$TMP/baseline" "$TMP/func_base"; node tests/e2e/functional.js "$ROOT" "$TMP/func_new"; diff "$TMP/func_base/func-results.json" "$TMP/func_new/func-results.json" && echo "✓ chức năng trùng bản gốc"
