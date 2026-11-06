import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const MODEL = 'openai/gpt-oss-20b'
const MAX_CHARS = 12000

function prepareText(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('Document is empty.')
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= MAX_CHARS) return { text: cleaned, truncated: false }
  const head = cleaned.slice(0, MAX_CHARS * 0.7)
  const tail = cleaned.slice(-MAX_CHARS * 0.3)
  return { text: `${head}\n\n[... middle section omitted for length ...]\n\n${tail}`, truncated: true }
}

function parseJSON(content) {
  const cleaned = (content || '').replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('AI returned an unexpected format. Please try again.')
  return JSON.parse(cleaned.slice(start, end + 1))
}

async function askJSON(system, user) {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.1,
    max_completion_tokens: 1500,
    reasoning_effort: 'low',
    response_format: { type: 'json_object' },
  })
  return parseJSON(completion.choices[0].message.content)
}

export async function summarize(rawText) {
  const { text, truncated } = prepareText(rawText)
  const result = await askJSON(
    'You are a legal document analyzer for Indian users. Explain agreements in plain, simple English. Respond with valid JSON only.',
    `Analyze this agreement and return JSON with exactly these fields:
{
  "summary": "2-3 sentence plain English summary",
  "data_collected": ["data types collected, empty if not applicable"],
  "duration": "how long the agreement or data retention lasts",
  "vendors": ["third parties mentioned"],
  "purpose": ["purposes"],
  "risk_level": "Low or Medium or High",
  "key_concerns": ["clauses a normal person should look at carefully"]
}

Document:
${text}`
  )
  if (truncated) {
    result.summary = `${result.summary} (Note: this document was long, so the middle section was skipped.)`
  }
  return result
}

export async function compare(oldRaw, newRaw) {
  const a = prepareText(oldRaw)
  const b = prepareText(newRaw)
  return askJSON(
    'You are a legal document comparison expert. Respond with valid JSON only.',
    `Compare these two versions and return JSON:
{
  "added": ["new clauses or obligations"],
  "removed": ["clauses removed"],
  "modified": ["clauses that changed"],
  "risk_change": "Increased or Decreased or Same",
  "summary": "plain English explanation of what changed and why it matters"
}

Version 1 (old):
${a.text.slice(0, MAX_CHARS / 2)}

Version 2 (new):
${b.text.slice(0, MAX_CHARS / 2)}`
  )
}