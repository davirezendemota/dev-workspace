# Workspace — agent instructions

## Specs workflow

The project keeps requirements in `.specs/features/*.md` and delivery state in `.specs/spec-checklist.json`.

**Start of task:** Read the matching spec file and checklist entry. Honor `before`/`after` dependencies. If no spec exists, create one from `.specs/spec-template.md` and register it in the checklist first.

**While working:** Set the AC `status` to `in-progress`. Add GitHub `issues` / `prs` numbers when available. Never write progress checkboxes in spec markdown.

**End of task:** Set completed ACs to `done`, use `blocked` when stuck on external deps, and bump `updatedAt` in `spec-checklist.json`. Keep AC IDs in sync between markdown and JSON.

Reference: `.specs/README.md`

### Slash commands

- `/bootstrap-specs` — full .specs integration setup (rules, commands, skills, checklist)
- `/update-specs` — sync codebase → `.specs/features` + `spec-checklist.json`
- `/new-spec` — create spec from template + checklist entries
- `/spec-checklist` — start/complete/block ACs; list pendencies (e.g. "start AC2 of spec 003")

Installed from `.specs/templates/` via `.specs/bootstrap-ai-rules.md`.
