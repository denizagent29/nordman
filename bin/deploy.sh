#!/usr/bin/env bash
# Publish nordman to its web root. Served statically by Caddy (vhost
# nordman.denizsincar.ru → /var/www/html/nordman), so publishing is just an
# upload — no build step, nothing to restart.
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=/var/www/html/nordman
python3 ../vps/ssh_run.py "mkdir -p $DEST/src $DEST/data"
python3 ../vps/put_files.py \
  index.html $DEST/index.html \
  src/app.js $DEST/src/app.js \
  src/announce.js $DEST/src/announce.js \
  src/debounce.js $DEST/src/debounce.js \
  src/log.js $DEST/src/log.js \
  src/midi.js $DEST/src/midi.js \
  src/models.js $DEST/src/models.js \
  src/session.js $DEST/src/session.js \
  src/transport.js $DEST/src/transport.js \
  src/main.js $DEST/src/main.js \
  data/nord-piano-6.js $DEST/data/nord-piano-6.js \
  data/nord-stage-4.js $DEST/data/nord-stage-4.js
echo "deployed — https://nordman.denizsincar.ru/"
