import { PrivyClient } from '@privy-io/server-auth'

const privy = new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET)

export async function requireUser(req, res) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    res.status(401).json({ error: 'Please sign in to continue.' })
    return null
  }
  try {
    return await privy.verifyAuthToken(token)
  } catch {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
    return null
  }
}