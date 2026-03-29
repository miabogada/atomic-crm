---
name: Use absolute paths when running scripts over SSH
description: When SSH-ing to dev LXC as root, always use full repo path — CWD is /root/, not the repo
type: feedback
---

When running Python scripts (or any command) over SSH to the dev LXC (`root@10.0.10.229`), ALWAYS use the full absolute path to the repo: `/home/f4rrest/Documents/clarklaw-domain/atomic-crm/`.

The root user's home is `/root/`, NOT the repo directory. Relative paths like `migration/fetch_sample.py` will fail.

Correct: `ssh -i ~/.ssh/claude_code root@10.0.10.229 "cd /home/f4rrest/Documents/clarklaw-domain/atomic-crm && python3 migration/fetch_sample.py [args]"`

Wrong: `ssh -i ~/.ssh/claude_code root@10.0.10.229 "python3 migration/fetch_sample.py [args]"`

**Why:** User had to correct this 7 times in a single session. The local CWD is the repo root, which creates a false assumption that the remote CWD is also the repo root. It is not.

**How to apply:** Every time you construct an SSH command to run a script on the remote LXC, explicitly include `cd /home/f4rrest/Documents/clarklaw-domain/atomic-crm &&` before the command, or use absolute paths for all file references.
