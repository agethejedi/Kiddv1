import { chromium, Browser, Page } from 'playwright-core'
import { Flow, FlowStep } from '@demoagent/shared'

const BROWSERLESS_WS = process.env.BROWSERLESS_WS_ENDPOINT!
const BROWSERLESS_KEY = process.env.BROWSERLESS_API_KEY!

export interface RecordingResult {
  flow_id: string
  frames_dir: string
  click_events: ClickEvent[]
  dom_snapshot: string
  duration_ms: number
}

export interface ClickEvent {
  timestamp_ms: number
  x: number
  y: number
  selector: string
  description: string
}

// Connect to Browserless-hosted Chrome
async function getBrowser(): Promise<Browser> {
  const wsEndpoint = `${BROWSERLESS_WS}?token=${BROWSERLESS_KEY}`
  return chromium.connectOverCDP(wsEndpoint)
}

// Analyze a URL and return candidate flows (uses DOM snapshot)
export async function analyzeSite(url: string): Promise<{
  dom_snapshot: string
  nav_links: string[]
  interactive_elements: string[]
}> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    await page.goto(url, { waitUntil: 'networkidle' })

    const dom_snapshot = await page.content()

    const nav_links = await page.$$eval(
      'a[href], nav a, [role="navigation"] a',
      (els) => els.map((el) => (el as HTMLAnchorElement).href).filter(Boolean)
    )

    const interactive_elements = await page.$$eval(
      'button, [role="button"], input, select, textarea, [onclick]',
      (els) =>
        els.map((el) => {
          const e = el as HTMLElement
          return `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${
            e.className ? '.' + e.className.split(' ')[0] : ''
          } — "${e.textContent?.trim().slice(0, 60) || ''}"`
        })
    )

    return { dom_snapshot, nav_links, interactive_elements }
  } finally {
    await browser.close()
  }
}

// Record a single flow by executing its steps and capturing frames
export async function recordFlow(
  url: string,
  flow: Flow,
  outputDir: string
): Promise<RecordingResult> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const click_events: ClickEvent[] = []
  const startTime = Date.now()

  await page.setViewportSize({ width: 1280, height: 800 })

  // Start CDP screencast
  const cdpSession = await page.context().newCDPSession(page)
  const frames: Buffer[] = []

  await cdpSession.send('Page.startScreencast', {
    format: 'png',
    quality: 85,
    maxWidth: 1280,
    maxHeight: 800,
    everyNthFrame: 1,
  })

  cdpSession.on('Page.screencastFrame', async ({ data, sessionId }) => {
    frames.push(Buffer.from(data, 'base64'))
    await cdpSession.send('Page.screencastFrameAck', { sessionId })
  })

  try {
    await page.goto(url, { waitUntil: 'networkidle' })

    for (const step of flow.steps) {
      await executeStep(page, step, click_events, startTime)
      await page.waitForTimeout(800)
    }

    await cdpSession.send('Page.stopScreencast')
    const dom_snapshot = await page.content()

    // Write frames to disk
    const fs = await import('fs/promises')
    await fs.mkdir(outputDir, { recursive: true })
    for (let i = 0; i < frames.length; i++) {
      await fs.writeFile(
        `${outputDir}/frame_${String(i).padStart(5, '0')}.png`,
        frames[i]
      )
    }

    return {
      flow_id: flow.id,
      frames_dir: outputDir,
      click_events,
      dom_snapshot,
      duration_ms: Date.now() - startTime,
    }
  } finally {
    await browser.close()
  }
}

async function executeStep(
  page: Page,
  step: FlowStep,
  click_events: ClickEvent[],
  startTime: number
): Promise<void> {
  switch (step.action) {
    case 'navigate':
      if (step.value) await page.goto(step.value, { waitUntil: 'networkidle' })
      break

    case 'click': {
      if (!step.selector) break
      const el = await page.waitForSelector(step.selector, { timeout: 5000 })
      if (!el) break
      const box = await el.boundingBox()
      if (box) {
        click_events.push({
          timestamp_ms: Date.now() - startTime,
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
          selector: step.selector,
          description: step.description,
        })
      }
      await el.click()
      break
    }

    case 'type':
      if (step.selector && step.value) {
        await page.fill(step.selector, step.value)
      }
      break

    case 'scroll':
      await page.evaluate(() => window.scrollBy(0, 400))
      break

    case 'wait':
      await page.waitForTimeout(Number(step.value) || 1000)
      break
  }
}
