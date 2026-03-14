---
name: Prod password workflow
description: User always pastes the prod DB password directly in chat — don't try interactive scripts or ask them to run commands in a separate terminal
type: feedback
---

When a prod DB password is needed (for sync scripts, psql commands, etc.), ask the user to paste it in the chat. Do NOT:
- Try to run interactive scripts that use `read -rsp` (they fail in the Bash tool)
- Ask the user to run scripts in a separate terminal
- Try to read the password from files (it's not stored in `migration/.env`)

**Why:** The user has always provided the password by pasting it in chat. Suggesting alternative workflows wastes time and frustrates the user.

**How to apply:** When running `db-sync-prod-to-local.sh` or any prod DB command, ask for the password upfront, then pass it via environment variable (e.g., `PROD_PW=... bash scripts/db-sync-prod-to-local.sh`) or inline in the command. The sync script can be run non-interactively by piping the password and confirmation.
