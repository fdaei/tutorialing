# Production rollback

Tagged deployments retain the current source release and four prior releases in
`/home/deploy/lingospeak/releases`. A failed deployment restores the source
symlink automatically, but does not reverse database migrations or silently
restart an older application version.

Rollback is therefore an explicit operator action:

1. Identify the previous release and read its `GIT_SHA` file.
2. Confirm that the previous application is compatible with the current
   database schema. Prisma production migrations are forward-only.
3. Take a fresh backup and complete its restore verification.
4. Atomically repoint `/home/deploy/lingospeak/src` to the selected release.
5. Rebuild the selected tagged images, start API/web, and run verification.

Example, replacing `v1.2.2` with the reviewed target:

```bash
sudo -i
target=v1.2.2
root=/home/deploy/lingospeak
release="$root/releases/$target"
test -d "$release/source"
test -f "$release/GIT_SHA"

SERVER_IP=<production-ip> IMAGE_TAG="$target" \
  bash "$release/provision/deploy/deploy.sh" backup

ln -sfn "$release/source" "$root/src.rollback"
mv -Tf "$root/src.rollback" "$root/src"

SERVER_IP=<production-ip> IMAGE_TAG="$target" \
  bash "$release/provision/deploy/deploy.sh" build
SERVER_IP=<production-ip> IMAGE_TAG="$target" \
  bash "$release/provision/deploy/deploy.sh" edge
SERVER_IP=<production-ip> IMAGE_TAG="$target" \
  bash "$release/provision/deploy/deploy.sh" verify
```

Do not run `prisma migrate dev`, `prisma migrate reset`, volume deletion, or a
down-migration as part of this procedure. If the older application is not
forward-compatible with the current schema, roll forward with a corrective tag
instead.
