# Skills

Skill files (`SKILL.md`) for this project are resolved from two possible locations, in order of relevance:

1. **Project-tracked (primary)** — `.claude/skills/<skill-name>/SKILL.md`, relative to the repo root. This is committed to git and is the canonical location. All current skills (db-sync-prod-to-dev, db-compare, prod-query, dev-query, migration, backend-dev, frontend-dev) live here.
2. **Law-profile-level (alternate)** — `~/.claude-law/skills/<skill-name>/SKILL.md`. Per-workstation, not part of the repo. This project always launches from the `.claude-law` profile (never `~/.claude/`) — the assistant's cross-session memory for this project also lives under `~/.claude-law/projects/.../memory/`, but that is memory, not skills.

If a skill's referenced files (e.g. a script) appear to be missing, check location 1 relative to the **repo root** first, not relative to the skill's own directory — skill docs in this repo reference repo-root-relative paths (e.g. `scripts/foo.sh` means `<repo_root>/scripts/foo.sh`).
