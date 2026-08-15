# Secrets

Secrets live in the repository as sops-encrypted dotenv files, one per deployment environment: `secrets/dev.env`, `secrets/prod.env`. A change to a secret is a commit, so code and the secrets it needs move through the same branch, review, and deploy. Decryption needs an age identity and nothing else; no service sits in the boot path.

`pnpm secrets` wraps sops (`tools/secrets.ts`). Nothing else in the repository calls sops directly.

## Identities

Three age identities, generated with `age-keygen`:

| Identity   | Scope       | Private key lives                                                         | Recipient of |
| ---------- | ----------- | ------------------------------------------------------------------------- | ------------ |
| `personal` | user-wide   | your password manager                                                     | every file   |
| `agent`    | user-wide   | `~/.config/sops/age/keys.txt` on every machine agents run on              | `dev.env`    |
| `prod`     | per project | that project's production platform (Railway variable, systemd credential) | `prod.env`   |

`personal` and `agent` are local-development keys shared by every project. `prod` is generated when the project is bootstrapped and never reused: a leaked deploy variable exposes one project's history, and rotating it touches one repository.

`.sops.yaml` maps each file to its recipients by public key. Only public keys are committed. Encrypting requires no private key; decrypting or editing requires any one recipient's private key.

Every project lists the same `agent` public key for its dev file, so an agent session on that machine can read and write dev secrets in any checkout, worktree, or shell without a prompt. One file to install per machine.

## Elevation

An agent session cannot decrypt `prod.env` because `agent` is not a recipient. To let a checkout work on prod secrets, write the personal identity into `.age/elevated` in that checkout:

```sh
op read 'op://Personal/age-personal/private key' | pnpm secrets elevate
```

`.age/` is gitignored and lives inside the checkout, so a sibling worktree stays unelevated. Elevation lasts until you delete `.age/elevated`. The wrapper passes it to sops as `SOPS_AGE_KEY_FILE`; sops unions it with the user key file, so dev keeps working. Run the elevate command yourself when the password-manager read is interactive; the agent runs everything after it.

## Commands

```sh
pnpm secrets init dev                       # create secrets/dev.env from .sops.yaml recipients
pnpm secrets set dev STRIPE_KEY sk_test_1   # add or replace
pnpm secrets get dev STRIPE_KEY
pnpm secrets unset dev STRIPE_KEY
pnpm secrets show dev                       # decrypted file on stdout
pnpm secrets edit dev                       # $EDITOR on the decrypted file
pnpm secrets exec dev -- node apps/worker/src/main.ts
```

`exec` decrypts, spawns the command with the values in its environment (decrypted values override the shell), strips `SOPS_AGE_KEY*` from the child, forwards `SIGINT`, `SIGTERM`, and `SIGHUP`, and exits with the child's status. Composes with eph: `.eph` `run=` lines and `eph run` wrap the command in `pnpm secrets exec dev --`.

Values are JSON-quoted on the way into sops, so a value with spaces or quotes round-trips as typed. Comments in the file are preserved and encrypted.

## Rotation

- Add or replace a recipient: edit `.sops.yaml`, then `sops updatekeys -y secrets/<env>.env` for each file, holding a private key that can already decrypt it. Commit both.
- A leaked `agent` or `personal` key: rotate the key as above, then change every value the leaked key could read. Encrypted history stays readable to whoever holds the old key.

## Cloud agents and sandboxes

The `agent` private key is the only input. Put it in the platform's variable field as `SOPS_AGE_KEY=AGE-SECRET-KEY-1...`; sops reads that variable directly. Nothing else needs network access, so Claude Code on the web works with network set to none. Codex cloud removes secrets before the agent phase, so use its environment variables field, not its secrets field. Daytona and Cursor take the same variable. Never put `personal` or `prod` in a cloud environment.

The sandbox also needs the `sops` binary. The Codex setup script installs it when missing; give a Claude Code web environment or a Daytona snapshot the same two lines (`curl` the release binary to `/usr/local/bin/sops`, `chmod 755`).

## Production

Set `SOPS_AGE_KEY` (the `prod` identity) on the service and start through `pnpm secrets exec prod -- <command>`. The container needs the `sops` binary (one static file, about 15 MB) and `secrets/` plus `.sops.yaml` copied in. The [Release](capabilities/release.md) recipe includes both.

On a bare server, keep the key out of the unit file and out of `/proc`:

```sh
printf '%s' "$AGE_PROD_KEY" | systemd-creds encrypt --name=age-prod - /etc/credstore.encrypted/age-prod.cred
```

```ini
[Service]
LoadCredentialEncrypted=age-prod:/etc/credstore.encrypted/age-prod.cred
Environment=SOPS_AGE_KEY_FILE=%d/age-prod
ExecStart=/usr/bin/node tools/secrets.ts exec prod -- node apps/server/src/main.ts
```

`systemd-creds` binds the credential to the host's TPM or `/var/lib/systemd/credential.secret`, and `%d` resolves to a per-service tmpfs that only that service can read.

## Rules

- Secrets go in `secrets/<env>.env`. `.env` files are gone; `.gitignore` still ignores them so a stray one is never committed.
- Configuration that is not secret (ports, feature flags, `APP_ENV`) stays in `.eph` and the env schema defaults, not in sops.
- The env schema ([Environment](capabilities/env.md)) is the contract. A variable present in `dev.env` and missing in `prod.env` fails the prod boot, which is the intended signal.
- `SOPS_AGE_KEY`, `SOPS_AGE_KEY_FILE`, and `.age/` never enter a commit, an image layer, or a log.
