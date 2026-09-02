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
