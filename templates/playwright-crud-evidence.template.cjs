const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')

const CONFIG = {
  baseUrl: process.env.E2E_BASE_URL || 'http://127.0.0.1:8000',
  targetPath: process.env.E2E_TARGET_PATH || '/target-page',
  loginPathHint: process.env.E2E_LOGIN_HINT || '/login',
  credentials: {
    email: process.env.E2E_EMAIL || 'replace@example.com',
    password: process.env.E2E_PASSWORD || 'replace-password'
  },
  modules: ['Module A', 'Module B'],
  outputRoot: path.resolve('evidencias/playwright-crud'),
  timeoutMs: 15000,
  headless: process.env.E2E_HEADED !== '1',
  viewport: { width: 1600, height: 1200 },
  selectors: {
    loginEmail: 'E-mail',
    loginPassword: 'Senha',
    loginSubmitButton: 'Entrar',
    moduleButton: '.module-button',
    createOpenButton: 'button.fab-add',
    formCard: '.form-card',
    saveButton: 'Salvar',
    rowWithActions: '.table tbody tr:has(button)',
    actionButtonsInRow: 'button',
    quickFilterInput: 'input[placeholder*="Pesquisa"]',
    deleteConfirmCheckbox: 'input[type="checkbox"]',
    deleteConfirmButton: 'Desativar',
    toastCard: '.toast-card',
    toastSuccessClassFragment: 'success',
    toastClose: '.toast-close',
    closeButtonInModal: '.modal-card button'
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-')
const slug = (v) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

const stepResult = () => ({ status: 'blocked', note: '', screenshot: null, screenshotRelative: null, url: '' })

function isOk(step) {
  return step.status === 'ok'
}

async function capture(page, runDir, moduleName, stepName) {
  const fileName = `${slug(moduleName)}-${stepName}.png`
  const absolute = path.join(runDir, fileName)
  const relative = `./${fileName}`
  await page.screenshot({ path: absolute, fullPage: true })
  return { absolute, relative }
}

async function executeStep(page, runDir, moduleName, stepName, fn) {
  const result = stepResult()
  try {
    const data = await fn()
    const shot = await capture(page, runDir, moduleName, stepName)
    result.status = data?.ok ? 'ok' : 'fail'
    result.note = data?.note || ''
    result.screenshot = shot.absolute
    result.screenshotRelative = shot.relative
    result.url = page.url()
    return result
  } catch (error) {
    const shot = await capture(page, runDir, moduleName, `${stepName}-error`).catch(() => null)
    result.status = 'fail'
    result.note = String(error?.message || error)
    result.screenshot = shot?.absolute || null
    result.screenshotRelative = shot?.relative || null
    result.url = page.url()
    return result
  }
}

async function readinessCheck(page) {
  const url = `${CONFIG.baseUrl}${CONFIG.targetPath}`
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (!response || !response.ok()) {
    throw new Error(`Target page not reachable: ${url}`)
  }
}

async function ensureLoggedIn(page) {
  await page.goto(`${CONFIG.baseUrl}${CONFIG.targetPath}`, { waitUntil: 'domcontentloaded' })
  if (!page.url().includes(CONFIG.loginPathHint)) return

  await page.getByLabel(CONFIG.selectors.loginEmail).fill(CONFIG.credentials.email)
  await page.getByLabel(CONFIG.selectors.loginPassword).fill(CONFIG.credentials.password)
  await page.getByRole('button', { name: CONFIG.selectors.loginSubmitButton }).click()
  await page.waitForTimeout(1500)
}

async function closeOverlays(page) {
  await page.locator(CONFIG.selectors.toastClose).first().click({ force: true }).catch(() => {})
  await page
    .locator(CONFIG.selectors.closeButtonInModal, { hasText: 'Fechar' })
    .first()
    .click({ force: true })
    .catch(() => {})
}

async function waitToast(page) {
  const toast = page.locator(CONFIG.selectors.toastCard).first()
  await toast.waitFor({ state: 'visible', timeout: 10000 })
  const klass = (await toast.getAttribute('class')) || ''
  return {
    ok: klass.includes(CONFIG.selectors.toastSuccessClassFragment),
    message: (await toast.innerText()).trim()
  }
}

function blockedStep(reason) {
  return {
    status: 'blocked',
    note: reason,
    screenshot: null,
    screenshotRelative: null,
    url: ''
  }
}

async function runModule(page, runDir, moduleName, runId) {
  const result = {
    module: moduleName,
    create: blockedStep('not-run'),
    view: blockedStep('not-run'),
    edit: blockedStep('not-run'),
    filter: blockedStep('not-run'),
    delete: blockedStep('not-run')
  }

  await closeOverlays(page)
  await page.locator(CONFIG.selectors.moduleButton, { hasText: moduleName }).first().click({ timeout: CONFIG.timeoutMs })

  const stableIdentity = `${slug(moduleName)}-${runId}`

  result.create = await executeStep(page, runDir, moduleName, '01-create', async () => {
    await page.locator(CONFIG.selectors.createOpenButton).click()
    await page.locator(CONFIG.selectors.formCard).waitFor({ timeout: CONFIG.timeoutMs })
    // TODO: fill required fields deterministically using stableIdentity
    await page.getByRole('button', { name: CONFIG.selectors.saveButton }).click()
    const toast = await waitToast(page)
    return { ok: toast.ok, note: `${toast.message} | identity=${stableIdentity}` }
  })

  if (!isOk(result.create)) {
    const reason = `blocked by create: ${result.create.note}`
    result.view = blockedStep(reason)
    result.edit = blockedStep(reason)
    result.filter = blockedStep(reason)
    result.delete = blockedStep(reason)
    return result
  }

  const row = page.locator(CONFIG.selectors.rowWithActions).first()
  await row.waitFor({ timeout: CONFIG.timeoutMs })
  const firstCell = (await row.locator('td').first().innerText()).trim()

  result.view = await executeStep(page, runDir, moduleName, '02-view', async () => {
    await row.locator(CONFIG.selectors.actionButtonsInRow).nth(0).click()
    await sleep(250)
    await closeOverlays(page)
    return { ok: true, note: 'view opened' }
  })

  result.edit = await executeStep(page, runDir, moduleName, '03-edit', async () => {
    await row.locator(CONFIG.selectors.actionButtonsInRow).nth(1).click()
    // TODO: edit one deterministic field
    await page.getByRole('button', { name: CONFIG.selectors.saveButton }).click()
    const toast = await waitToast(page)
    return { ok: toast.ok, note: toast.message }
  })

  result.filter = await executeStep(page, runDir, moduleName, '04-filter', async () => {
    await page.locator(CONFIG.selectors.quickFilterInput).first().fill(firstCell.slice(0, 20))
    await sleep(300)
    const rows = await page.locator(CONFIG.selectors.rowWithActions).count()
    return { ok: rows > 0, note: `rows_after_filter=${rows}` }
  })

  result.delete = await executeStep(page, runDir, moduleName, '05-delete', async () => {
    await row.locator(CONFIG.selectors.actionButtonsInRow).nth(2).click()
    await page.locator(CONFIG.selectors.deleteConfirmCheckbox).first().check().catch(() => {})
    await page.getByRole('button', { name: CONFIG.selectors.deleteConfirmButton }).click()
    const toast = await waitToast(page)
    return { ok: toast.ok, note: toast.message }
  })

  return result
}

function renderMarkdown(meta, runDir, results) {
  const lines = []
  lines.push('# Playwright CRUD Evidence Report')
  lines.push('')
  lines.push(`- Run dir: \`${runDir}\``)
  lines.push(`- Generated at: ${new Date().toISOString()}`)
  lines.push(`- Base URL: ${meta.baseUrl}`)
  lines.push(`- Browser: ${meta.browserName} ${meta.browserVersion}`)
  lines.push(`- Headless: ${meta.headless}`)
  lines.push(`- Viewport: ${meta.viewport.width}x${meta.viewport.height}`)
  lines.push('')
  lines.push('| Module | Create | View | Edit | Filter | Delete |')
  lines.push('|---|---|---|---|---|---|')

  const mark = (x) => (x.status === 'ok' ? '✅' : x.status === 'blocked' ? '⛔' : '❌')
  for (const m of results) {
    lines.push(`| ${m.module} | ${mark(m.create)} | ${mark(m.view)} | ${mark(m.edit)} | ${mark(m.filter)} | ${mark(m.delete)} |`)
  }

  lines.push('')
  lines.push('## Details')
  lines.push('')
  for (const m of results) {
    lines.push(`### ${m.module}`)
    lines.push(`- Create: ${m.create.screenshotRelative || 'n/a'} ${m.create.note ? `— ${m.create.note}` : ''}`)
    lines.push(`- View: ${m.view.screenshotRelative || 'n/a'} ${m.view.note ? `— ${m.view.note}` : ''}`)
    lines.push(`- Edit: ${m.edit.screenshotRelative || 'n/a'} ${m.edit.note ? `— ${m.edit.note}` : ''}`)
    lines.push(`- Filter: ${m.filter.screenshotRelative || 'n/a'} ${m.filter.note ? `— ${m.filter.note}` : ''}`)
    lines.push(`- Delete: ${m.delete.screenshotRelative || 'n/a'} ${m.delete.note ? `— ${m.delete.note}` : ''}`)
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

async function main() {
  fs.mkdirSync(CONFIG.outputRoot, { recursive: true })
  const runDir = path.join(CONFIG.outputRoot, stamp())
  fs.mkdirSync(runDir, { recursive: true })

  const browser = await chromium.launch({ headless: CONFIG.headless })
  const context = await browser.newContext({ viewport: CONFIG.viewport })
  const page = await context.newPage()

  const results = []
  const runId = stamp().replace(/-/g, '').slice(0, 12)
  try {
    await readinessCheck(page)
    await ensureLoggedIn(page)
    await page.goto(`${CONFIG.baseUrl}${CONFIG.targetPath}`, { waitUntil: 'domcontentloaded' })

    for (const moduleName of CONFIG.modules) {
      try {
        results.push(await runModule(page, runDir, moduleName, runId))
      } catch (error) {
        const shot = await capture(page, runDir, moduleName, '00-module-error').catch(() => null)
        results.push({
          module: moduleName,
          create: {
            status: 'fail',
            note: String(error?.message || error),
            screenshot: shot?.absolute || null,
            screenshotRelative: shot?.relative || null,
            url: page.url()
          },
          view: blockedStep('blocked by module error'),
          edit: blockedStep('blocked by module error'),
          filter: blockedStep('blocked by module error'),
          delete: blockedStep('blocked by module error')
        })
      }
    }

    const meta = {
      baseUrl: CONFIG.baseUrl,
      targetPath: CONFIG.targetPath,
      runId,
      modules: CONFIG.modules,
      browserName: browser.browserType().name(),
      browserVersion: browser.version(),
      headless: CONFIG.headless,
      viewport: CONFIG.viewport,
      generatedAt: new Date().toISOString()
    }

    const jsonPath = path.join(runDir, 'resultado.json')
    fs.writeFileSync(jsonPath, JSON.stringify({ meta, results }, null, 2))

    const mdPath = path.join(runDir, 'resultado.md')
    fs.writeFileSync(mdPath, renderMarkdown(meta, runDir, results))

    console.log(JSON.stringify({ runDir, jsonPath, mdPath, modules: results.length }, null, 2))
  } finally {
    await context.close()
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
