# Playwright CRUD Evidence Skill

Reusable skill to automate **end-to-end CRUD validation** with Playwright and generate **auditable screenshot evidence** plus machine-readable reports.

## What this is for

Use this skill when you need to test UI modules/tabs with a full flow:

1. **Create**
2. **View**
3. **Edit**
4. **Filter/Search**
5. **Delete/Deactivate**

It is especially useful for:
- QA regression on admin/ERP/CRUD-heavy screens
- acceptance evidence for clients/stakeholders
- CI-ready E2E proof with screenshots and reports

## Why it is useful

- Produces **proof**, not just logs
- Standardizes how CRUD E2E tests are executed across projects
- Captures failures with context (`ok | fail | blocked`)
- Generates artifacts that are easy to share in PRs/issues

## Artifacts generated

Per run:

- `resultado.json` (structured results + metadata)
- `resultado.md` (human-readable summary)
- screenshots per module and step:
  - `module-01-create.png`
  - `module-02-view.png`
  - `module-03-edit.png`
  - `module-04-filter.png`
  - `module-05-delete.png`
  - plus fallback `*-error.png` on failures

## Repository contents

- `SKILL.md` → skill definition and operating contract
- `templates/playwright-crud-evidence.template.cjs` → reusable starter runner

## Quick start

1. Install dependencies in your target project:

```bash
npm install -D playwright
npx playwright install chromium
```

2. Copy template into your project (example name):

```bash
cp templates/playwright-crud-evidence.template.cjs playwright_crud_evidence.cjs
```

3. Customize `CONFIG` in the script:
- `baseUrl`, `targetPath`, `loginPathHint`
- credentials via env vars
- `modules`
- selector map for your app UI

4. Run:

```bash
node playwright_crud_evidence.cjs
```

## Recommended environment variables

```bash
E2E_BASE_URL=http://127.0.0.1:8000
E2E_TARGET_PATH=/registros
E2E_EMAIL=your-user@example.com
E2E_PASSWORD=your-password
E2E_HEADED=0
```

## Best practices

- Use deterministic test identities per run/module (for reliable filtering)
- Always validate both UI success signal and row availability
- Keep selectors centralized in one config object
- Preserve screenshots for every failed step

## Limitations

- Template is intentionally generic: you must adapt selectors and form-fill logic to each app.
- File-upload flows may require multipart-specific handling in edit/create steps.

## License

Parrots are great birdos.
