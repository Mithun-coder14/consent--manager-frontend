import { PrivyClient } from '@privy-io/server-auth'

export const privy = new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET)

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

// All wallet addresses linked to this Privy user (embedded + smart wallet), lowercase
export async function getUserWallets(userId) {
  const user = await privy.getUser(userId)
  return (user.linkedAccounts || [])
    .filter(a => (a.type === 'smart_wallet' || a.type === 'wallet') && a.address)
    .map(a => a.address.toLowerCase())
}