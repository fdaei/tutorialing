# Infrastructure deployment

This directory contains reusable deployment automation. Real host addresses,
usernames, SSH aliases, local paths, exposed-port mappings, firewall topology,
and recovery locations are intentionally excluded from public documentation.

Use the private operations runbook with these placeholders:

- `SERVER_HOST`: production host or approved SSH alias
- `SERVER_USER`: least-privileged deployment account
- `DEPLOY_ROOT`: private application directory on the server
- `PROVISION_ROOT`: private provisioning directory on the server

Required controls include least-privilege SSH access, deny-by-default ingress,
loopback-only data-service bindings, persistent database/object-storage volumes,
encrypted backups with restore tests, and secret injection from a private secret
manager. Exact firewall rules and validation commands remain private so the
public repository does not disclose production topology.
