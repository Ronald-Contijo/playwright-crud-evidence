---
name: playwright-crud-evidence
description: Reusable Playwright workflow to automate end-to-end CRUD validation (create, view, edit, filter, delete) with screenshot evidence and markdown/json reports. Use when you need auditable UI test execution across modules/tabs in web apps.
---

# Playwright CRUD + Screenshot Evidence Skill

Use this skill when a user asks to:
- test full CRUD flows in a UI
- generate visual evidence (screenshots)
- validate many modules/tabs in one run
- produce a report (`resultado.md` / `resultado.json`) with pass/fail by module

## Outcome

At the end of execution, you must deliver:
1. Real browser execution (Playwright, headless or headed)
2. Per-module CRUD status matrix
3. Per-step screenshots (`01-create`, `02-view`, `03-edit`, `04-filter`, `05-delete`)
4. Markdown and JSON report files

## Standard Flow

1. **Prepare runtime**
   - Install Playwright dependency and browser binaries if needed.
   - Validate target URL reachability.
   - Ensure deterministic credentials from provided fixture/source.

2. **Implement deterministic runner script**
   - Login (if redirected to `/login`)
   - Iterate modules list
   - For each module run: create → view → edit → filter → delete
   - Capture screenshot after every step
   - Keep UI clean between actions (close toast/modal overlays)
   - Record deterministic identity per module/run (for reliable filter/edit/delete targeting)

3. **Generate artifacts**
   - `.../evidencias/<suite>/<timestamp>/resultado.json`
   - `.../evidencias/<suite>/<timestamp>/resultado.md`
   - `.../evidencias/<suite>/<timestamp>/<module>-01-create.png` ... `-05-delete.png`
   - Include run metadata (base URL, browser version, headless/headed, viewport, modules list)

4. **Report clearly**
   - Mention total modules, full passes, partial fails
   - Provide exact failing message for each failed step
   - Provide absolute paths to artifacts

## Guardrails

- Never claim CRUD was tested if only navigation screenshots were captured.
- Treat success only when the UI confirms success (toast/status) and row/action is available for next step.
- If create succeeds but row is missing, mark downstream steps as failed/blocked.
- Use robust selectors (`role`, stable class patterns) and retries only where needed.
- Avoid destructive cleanup outside created test records.
- On any step error, always capture fallback screenshot (`00-module-error` or `<step>-error`).

## Required Evidence Contract (per module)

Each module must include:
- `create.status` + create screenshot + backend/UI message
- `view.status` + view screenshot
- `edit.status` + edit screenshot + message
- `filter.status` + filter screenshot + row count after filter
- `delete.status` + delete screenshot + message

Where `status` ∈ `ok | fail | blocked`.

If any step fails, preserve screenshot and error text. If downstream was not executed, mark as `blocked` and include `blocked by <step>` note.

## Configuration-First Requirement

The runner must centralize all project-specific assumptions in one config object:
- routes/paths (`baseUrl`, `targetPath`, `loginPathHint`)
- credentials (prefer env vars)
- selectors map (login, module button, action buttons, toast/modal, filter)
- runtime flags (`headless/headed`, viewport, timeout)

Avoid hardcoding selectors inline in flow logic.

## Recommended Directory Layout

```text
evidencias/
  registros-crud/
    2026-03-24T15-32-33-826Z/
      resultado.json
      resultado.md
      propriedades-01-create.png
      propriedades-02-view.png
      ...
```

## Minimal Command Playbook

```bash
# Install (project local)
npm install -D playwright
npx playwright install chromium

# Run runner script
node playwright_crud_evidence.cjs
```

## Reusable Template

Use `templates/playwright-crud-evidence.template.cjs` as the starting point.

What to customize first:
- `CONFIG.baseUrl`, `CONFIG.targetPath`, `CONFIG.loginPathHint`
- `CONFIG.credentials` via environment variables
- `CONFIG.modules`
- `CONFIG.selectors` for your UI structure
- required form-fill logic in create/edit steps

## Failure Classification Pattern

- **Validation failure**: form constraints (e.g., max length, required fields)
- **UI transition failure**: modal/toast overlay intercepting clicks
- **Persistence/listing mismatch**: create success toast but row not visible
- **Encoding/upload failure**: backend expects multipart/file but receives invalid payload

Always include category + raw message in `resultado.md`.
