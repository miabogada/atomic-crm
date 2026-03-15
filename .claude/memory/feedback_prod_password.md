---
name: Prod password workflow
description: CRITICAL — User pastes prod DB password in chat. NEVER ask user to run scripts themselves or suggest separate terminals. This has been violated 5 times.
type: feedback
---

When a prod DB password is needed (for sync scripts, psql commands, etc.):

1. Ask the user to paste the password in the chat
2. Run the command yourself using the Bash tool, passing the password non-interactively

**How to run the sync script non-interactively:**
```bash
echo "PASSWORD_HERE" | bash -c 'read -r pw; echo "$pw"; echo "y"' | bash scripts/db-sync-prod-to-local.sh
```
Or extract the commands from the script and run them directly with the password as an env var.

**NEVER DO ANY OF THESE:**
- Ask the user to run scripts in a separate terminal
- Say "you'll need to run this one yourself"
- Try to run interactive scripts that use `read -rsp` without piping input
- Suggest the user open another shell

**Why:** This feedback has been given 5 times. The user pastes the password in chat.
That is the workflow. Period.

**How to apply:** EVERY time a prod DB operation is needed, ask for the password
first, then run the command yourself via Bash tool with the password piped in.
