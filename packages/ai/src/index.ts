import Anthropic from '@anthropic-ai/sdk'
import { Flow, FlowStep } from '@demoagent/shared'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-sonnet-4-20250514'

// Given a DOM snapshot + interactive elements, identify demo-worthy flows
export async function detectFlows(
  url: string,
  dom_snapshot: string,
  nav_links: string[],
  interactive_elements: string[]
): Promise<Omit<Flow, 'id' | 'project_id' | 'status'>[]> {
  const prompt = `You are analyzing a web application to identify the most valuable product demo flows.

URL: ${url}

Interactive elements found:
${interactive_elements.slice(0, 60).join('\n')}

Navigation links found:
${nav_links.slice(0, 30).join('\n')}

DOM snapshot (truncated):
${dom_snapshot.slice(0, 8000)}

Identify 4-6 distinct user flows that would make compelling 30-60 second product demo clips.
Focus on flows that show clear value to new users.

Return a JSON array of flows. Each flow must have:
- title: short, action-oriented (e.g. "Starting your first chat")
- description: one sentence explaining what this demo shows
- steps: array of steps, each with:
  - order: number
  - action: one of "navigate" | "click" | "type" | "scroll" | "wait"
  - selector: CSS selector (if action is click/type)
  - value: URL for navigate, text for type, ms for wait
  - description: plain English description of this step

Return ONLY valid JSON, no markdown, no explanation.`

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json|```/g, '').trim()
  return JSON.parse(cleaned) as Omit<Flow, 'id' | 'project_id' | 'status'>[]
}

// Generate a narration script for a recorded flow
export async function generateScript(
  flow: Flow,
  dom_snapshot: string,
  click_events: Array<{ description: string; timestamp_ms: number }>
): Promise<string> {
  const prompt = `You are writing narration for a product demo video. The demo shows a user completing the following flow:

Flow title: "${flow.title}"
Flow description: ${flow.description}

Steps performed:
${flow.steps.map((s, i) => `${i + 1}. ${s.description}`).join('\n')}

Click events recorded:
${click_events.map((c) => `- At ${(c.timestamp_ms / 1000).toFixed(1)}s: ${c.description}`).join('\n')}

Write a warm, clear narration script for this demo clip. Requirements:
- 80-120 words total (for a 30-45 second clip)
- Conversational and welcoming tone — speak directly to the viewer
- Describe what's happening on screen as it happens
- Highlight the user benefit, not just the mechanics
- No filler phrases like "simply" or "just" or "easy"
- End with what the user has now accomplished

Return only the narration text, no labels or formatting.`

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// Regenerate a script with a specific instruction
export async function regenerateScript(
  currentScript: string,
  instruction: string
): Promise<string> {
  const prompt = `Here is an existing narration script for a product demo video:

"${currentScript}"

Rewrite it with this instruction: ${instruction}

Keep it 80-120 words. Return only the new narration text.`

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}
