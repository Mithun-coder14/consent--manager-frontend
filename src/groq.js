import { getAccessToken } from '@privy-io/react-auth'

async function callAI(body) {
  const token = await getAccessToken()
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `AI request failed (${response.status})`)
  return data
}

export const summarizeTandC = (text) => callAI({ task: 'summarize', text })
export const compareVersions = (oldText, newText) => callAI({ task: 'compare', oldText, newText })