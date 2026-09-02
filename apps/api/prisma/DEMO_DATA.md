# Controlled client demo data

This importer is separate from `prisma/seed.ts`. It never truncates or resets a table and it is allowed in production only through explicit operator confirmation. Every owned row uses the `client-demo-2026-` identifier prefix. Shared language and permission rows are reused without modification.

## Before import

1. Put the application into a controlled maintenance window.
2. Create and test a PostgreSQL backup, for example:

   ```sh
   pg_dump --format=custom --file=/srv/lingospeak/backups/pre-client-demo.dump "$DATABASE_URL"
   pg_restore --list /srv/lingospeak/backups/pre-client-demo.dump >/dev/null
   ```

3. Create a root-owned secrets directory (`0700`). The credential file must not already exist and must be outside the checkout.
4. Run the import once:

   ```sh
   DEMO_DATA_IMPORT=true \
   DEMO_DATA_BACKUP_CONFIRMED=true \
   DEMO_DATA_BACKUP_REFERENCE=/srv/lingospeak/backups/pre-client-demo.dump \
   DEMO_ADMIN_CREDENTIALS_FILE=/srv/lingospeak/secrets/client-demo-admin.credentials.txt \
   npm run db:demo:import
   ```

The generated password is written only to that new `0600` note and is never logged. Give access to the minimum number of presenters through the server's normal secure secret-sharing procedure.

## Verification

With the same `DEMO_DATA_IMPORT` and `DEMO_ADMIN_CREDENTIALS_FILE` variables, run `npm run db:demo:verify`. Then perform a browser smoke test through the deployed HTTPS endpoint: sign in with the protected note, open the admin dashboard, and confirm that a student-only route remains inaccessible to the admin. The command verifies the stored scrypt credential through the same format used by normal password login, the exact ADMIN-only role, all admin permissions, and dashboard counters. It never prints the credential.

## Removal

Take another backup, set `DEMO_DATA_IMPORT=true`, and run `npm run db:demo:remove`. Removal is transactional and targets only rows whose primary key starts with `client-demo-2026-`; shared languages and permission definitions are removed only when unused. After verifying the site, securely delete the protected credential note and revoke any active demo-admin sessions from the normal session-management path.

The importer deliberately creates placeholder image paths rather than uploading files. Supply matching public assets separately if the deployment does not already provide a placeholder fallback.
