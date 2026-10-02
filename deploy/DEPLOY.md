# Production deployment

Production hostnames, usernames, filesystem paths, network ports, firewall rules,
credential locations, and SSH configuration are maintained in the private
operations runbook. They must not be committed to this public repository.

## Safe public workflow

1. Provision the host using the private infrastructure configuration.
2. Create the production env file directly on the host with mode `600`, using
   values from the approved secret manager. Never derive it from a committed
   file or copy it into the repository.
3. Run the deployment phases in this order: environment validation, build,
   services, backup/restore verification, migrations, edge, verification.
4. Confirm the API health response reports both database and cache connectivity.
5. Exercise authentication, OTP delivery, administrator authorization, and file
   upload with designated production test accounts from the private runbook.

Use `SERVER_HOST` and `SERVER_USER` placeholders in public examples. Operational
commands containing real infrastructure details belong only in private docs.

## Building on a host that cannot reach binaries.prisma.sh

The api and web builds need Prisma's engines. Prisma downloads these from
`binaries.prisma.sh`, not from the npm registry, so an npm mirror does not
help. On a host where that site is blocked, `npm rebuild` waits for a timeout
and then passes without a word, and `prisma generate` fails with
`socket hang up`.

To avoid the download, copy the engines from a machine that has them (any
machine where `npm ci` ran with internet access) into
`deploy/prisma-engines/` of the build context on the host:

```bash
scp node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node \
    node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x \
    SERVER_USER@SERVER_HOST:<build-context>/deploy/prisma-engines/
```

The builder stages copy that folder into `node_modules/@prisma/engines/`, and
Prisma skips the download when a file with the right version is already
there. If the folder is empty (only `.gitkeep`), Prisma downloads as usual.

The files belong to one Prisma version. After upgrading Prisma, run `npm ci`
on the machine that has access and copy the files again. Otherwise the version
check fails and the build is back to waiting on the download.

## Secret rotation

- Back up the active env file before editing it.
- Generate URL-safe secrets, preferably with `openssl rand -hex`.
- Keep `POSTGRES_PASSWORD` identical to the decoded password in `DATABASE_URL`.
- A persistent PostgreSQL volume ignores a changed initialization password;
  rotate the database role in place with `ALTER ROLE` before recreating clients.
- Recreate only services that consume a changed credential.
- Never delete or reinitialize database or object-storage volumes during rotation.

## Recovery

Take a fresh database backup and complete a restore verification before schema
changes. Production restores are destructive operations and require a separate,
explicit approval under the private incident procedure.
