import { requireUser } from './_lib/auth.js'
import { summarize, compare } from './_lib/ai.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireUser(req, res)
  if (!user) return

  try {
    const { task, text, oldText, newText } = req.body || {}
    if (task === 'summarize') return res.status(200).json(await summarize(text))
    if (task === 'compare') return res.status(200).json(await compare(oldText, newText))
    return res.status(400).json({ error: 'Unknown AI task.' })
  } catch (err) {
    console.error('AI error:', err)
    const status = err?.status === 429 ? 429 : 500
    const message = status === 429
      ? 'The AI is busy right now. Please try again in a minute.'
      : err.message || 'AI analysis failed.'
    return res.status(status).json({ error: message })
  }
}