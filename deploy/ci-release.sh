#!/usr/bin/env bash
# Install and deploy an immutable CI payload on the production host.
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "ci-release.sh must run with sudo" >&2; exit 1; }

UPLOAD_DIR="${1:?upload directory is required}"
RELEASE_TAG="${RELEASE_TAG:?RELEASE_TAG is required}"
RELEASE_SHA="${RELEASE_SHA:?RELEASE_SHA is required}"
SERVER_IP="${SERVER_IP:?SERVER_IP is required}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
ROOT_DIR="/home/$DEPLOY_USER/lingospeak"
RELEASES_DIR="$ROOT_DIR/releases"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_TAG"
LOCK_FILE="$ROOT_DIR/.deploy.lock"

[[ $RELEASE_TAG =~ ^v([0-9]+\.[0-9]+\.[0-9]+|-test-[A-Za-z0-9._-]+)$ ]] || {
	echo "Invalid release tag: $RELEASE_TAG" >&2
	exit 1
}
[[ $RELEASE_SHA =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid release SHA" >&2; exit 1; }
[[ -d $UPLOAD_DIR && $UPLOAD_DIR == /home/$DEPLOY_USER/* ]] || {
	echo "Unsafe upload directory: $UPLOAD_DIR" >&2
	exit 1
}

exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Another production deployment is running" >&2; exit 1; }

cd "$UPLOAD_DIR"
sha256sum --check SHA256SUMS

install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 750 "$RELEASES_DIR"
[[ ! -e $RELEASE_DIR ]] || { echo "Release already exists: $RELEASE_TAG" >&2; exit 1; }
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 750 "$RELEASE_DIR/source" "$RELEASE_DIR/provision"
tar -xzf lingospeak-source.tar.gz -C "$RELEASE_DIR/source"
tar -xzf lingospeak-provision.tar.gz -C "$RELEASE_DIR/provision"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$RELEASE_DIR"
printf '%s\n' "$RELEASE_SHA" >"$RELEASE_DIR/GIT_SHA"

# Preserve the first manually deployed tree as a rollback candidate. Later
# releases use an atomic symlink switch and remain immutable under releases/.
previous="$(readlink -f "$ROOT_DIR/src" 2>/dev/null || true)"
if [[ -d $ROOT_DIR/src && ! -L $ROOT_DIR/src ]]; then
	manual="$RELEASES_DIR/manual-$(date -u +%Y%m%dT%H%M%SZ)"
	mv "$ROOT_DIR/src" "$manual"
	previous="$manual"
fi
ln -sfn "$RELEASE_DIR/source" "$ROOT_DIR/src.next"
mv -Tf "$ROOT_DIR/src.next" "$ROOT_DIR/src"

rollback_source() {
	if [[ -n $previous && -d $previous ]]; then
		ln -sfn "$previous" "$ROOT_DIR/src.rollback"
		mv -Tf "$ROOT_DIR/src.rollback" "$ROOT_DIR/src"
	fi
}
trap rollback_source ERR

SERVER_IP="$SERVER_IP" IMAGE_TAG="$RELEASE_TAG" RELEASE_TAG="$RELEASE_TAG" RELEASE_SHA="$RELEASE_SHA" \
	bash "$RELEASE_DIR/provision/deploy/deploy.sh" all

trap - ERR
install -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 640 /dev/null "$ROOT_DIR/RELEASE"
printf 'tag=%s\nsha=%s\ndeployed_at=%s\n' "$RELEASE_TAG" "$RELEASE_SHA" "$(date -u -Is)" >"$ROOT_DIR/RELEASE"

# Keep the current release and four prior tagged source trees. Manual snapshots
# are retained because their provenance cannot be recreated from Git.
mapfile -t old_releases < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -name 'v*' -printf '%T@ %p\n' | sort -nr | tail -n +6 | cut -d' ' -f2-)
for old in "${old_releases[@]}"; do
	if [[ $(readlink -f "$ROOT_DIR/src") != "$old/source" ]]; then
		old_tag="$(basename "$old")"
		docker image rm "lingospeak-api:$old_tag" "lingospeak-api-migrate:$old_tag" "lingospeak-web:$old_tag" \
			>/dev/null 2>&1 || true
		rm -rf -- "$old"
	fi
done

echo "Production release complete: $RELEASE_TAG ($RELEASE_SHA)"
