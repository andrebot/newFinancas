#!/usr/bin/env bash
# Mutation testing for the slice review (docs/architecture/13-slice-review.md).
#
#   scripts/mutation.sh api   The backend: one Stryker run over the whole API
#                             suite (stryker.api.config.json, ~30 min).
#   scripts/mutation.sh web   The web app, one Stryker run per source file over
#                             `vitest related <file>` (every test that imports
#                             it), then each shared package over its own suite
#                             (stryker.web.config.json, ~50 min). Reports are
#                             merged into reports/mutation/web/mutation.json.
#
# Both use Stryker's command runner: @stryker-mutator/vitest-runner reports
# false survivors under Vitest 5. A watchdog stops Stryker when available
# memory drops below MIN_FREE_MB (default 6000) — 16 workers once crashed the
# machine. RESUME=1 keeps the web per-file reports already written.
set -u
cd "$(dirname "$0")/.." || exit 1
MIN_FREE_MB=${MIN_FREE_MB:-6000}
WEB_OUT=reports/mutation/web/files

# Runs a command in the background and stops Stryker if memory runs low.
with_watchdog() {
  "$@" &
  local pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$(free -m | awk '/Mem:/ {print $7}')" -lt "$MIN_FREE_MB" ]; then
      echo "Available memory under ${MIN_FREE_MB} MB: stopping Stryker." >&2
      kill "$pid"
      pkill -f stryker
      return 1
    fi
    sleep 5
  done
  wait "$pid"
}

# Writes a per-run Stryker config: <out.json> <mutate JSON array> <command> <report name>.
web_config() {
  node -e "
const config = require('./stryker.web.config.json');
config.mutate = JSON.parse(process.argv[2]);
config.commandRunner.command = process.argv[3];
config.jsonReporter = { fileName: '$WEB_OUT/' + process.argv[4] + '.json' };
require('fs').writeFileSync(process.argv[1], JSON.stringify(config, null, 2));
" "$1" "$2" "$3" "$4"
}

# Runs one Stryker run over the web app per source file, then one per package.
run_web() {
  [ "${RESUME:-0}" = 1 ] || rm -rf "$WEB_OUT"
  mkdir -p "$WEB_OUT"
  local config=reports/mutation/web/run.json file name pkg
  find apps/web/src \( -name '*.ts' -o -name '*.tsx' \) ! -path '*/generated/*' \
    ! -name main.tsx | sort | while read -r file; do
    name=$(echo "${file#apps/web/src/}" | sed 's#/#__#g')
    [ -f "$WEB_OUT/$name.json" ] && continue
    web_config "$config" "[\"$file\"]" \
      "cd apps/web && npx vitest related ${file#apps/web/} --run --passWithNoTests --maxWorkers=2 --bail=1 --reporter=dot" \
      "$name"
    echo "== $file"
    npx stryker run "$config" > /dev/null 2>&1 || echo "FAILED $file" >&2
  done
  for pkg in packages/i18n packages/logging packages/reference tools/icons tools/ops; do
    name=pkg__$(echo "$pkg" | tr '/' '_')
    [ -f "$WEB_OUT/$name.json" ] && continue
    web_config "$config" "[\"$pkg/src/**/*.{ts,tsx}\", \"!$pkg/src/main.ts\"]" \
      "cd $pkg && npx vitest run --maxWorkers=2 --bail=1 --reporter=dot" "$name"
    echo "== $pkg"
    npx stryker run "$config" > /dev/null 2>&1 || echo "FAILED $pkg" >&2
  done
  node -e "
const fs = require('fs');
const merged = { schemaVersion: '1', thresholds: { high: 80, low: 60 }, files: {} };
for (const name of fs.readdirSync('$WEB_OUT')) {
  Object.assign(merged.files, JSON.parse(fs.readFileSync('$WEB_OUT/' + name)).files);
}
fs.writeFileSync('reports/mutation/web/mutation.json', JSON.stringify(merged));
const count = {};
for (const file of Object.values(merged.files)) for (const m of file.mutants) count[m.status] = (count[m.status] || 0) + 1;
const detected = (count.Killed || 0) + (count.Timeout || 0);
console.log(count, 'score', (100 * detected / (detected + (count.Survived || 0))).toFixed(1) + '%');
"
}

case "${1:-}" in
  api) with_watchdog npx stryker run stryker.api.config.json ;;
  web) with_watchdog run_web ;;
  *) echo "Usage: scripts/mutation.sh api|web" >&2; exit 2 ;;
esac
