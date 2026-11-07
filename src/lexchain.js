import { zeroAddress, toFunctionSelector } from 'viem'

// ============ STATUS LABELS ============
export const STATUS = {
  0: { label: '—', badge: 'badge-purple' },
  1: { label: 'Awaiting signatures', badge: 'badge-amber' },
  2: { label: 'Changes requested', badge: 'badge-amber' },
  3: { label: 'Active', badge: 'badge-green' },
  4: { label: 'Expired', badge: 'badge-red' },
  5: { label: 'Declined', badge: 'badge-red' },
  6: { label: 'Cancelled', badge: 'badge-red' },
}

export const S = { PENDING: 1, CHANGES_REQUESTED: 2, ACTIVE: 3, EXPIRED: 4, DECLINED: 5, CANCELLED: 6 }

export const VERSION_STATUS = {
  0: 'Draft', 1: 'Proposed', 2: 'In force', 3: 'Rejected', 4: 'Withdrawn', 5: 'Superseded', 6: 'Revised',
}

export const AGREEMENT_TYPES = [
  { id: 'tandc', label: 'T&C / Privacy Policy', icon: '📋' },
  { id: 'rental', label: 'Rental Agreement', icon: '🏠' },
  { id: 'employment', label: 'Employment Contract', icon: '💼' },
  { id: 'nda', label: 'NDA', icon: '🔒' },
  { id: 'freelance', label: 'Freelance Contract', icon: '💻' },
  { id: 'insurance', label: 'Insurance Policy', icon: '🛡️' },
  { id: 'lease', label: 'Lease Agreement', icon: '🔑' },
  { id: 'partnership', label: 'Partnership Agreement', icon: '🤝' },
]

export const typeIcon = (id) => AGREEMENT_TYPES.find(t => t.id === id)?.icon || '📄'
export const typeLabel = (id) => AGREEMENT_TYPES.find(t => t.id === id)?.label || id

export const isZero = (a) => !a || a.toLowerCase() === zeroAddress
export const sameAddress = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase()
export const formatDate = (ts) => (ts && Number(ts) > 0 ? new Date(Number(ts) * 1000).toLocaleDateString() : '—')
export const formatDateTime = (ts) => (ts && Number(ts) > 0 ? new Date(Number(ts) * 1000).toLocaleString() : '—')

// ============ INVITE LINKS ============
// Format: /agreement/<id>#invite=<privateKey>&kind=party|member&i=<index>

export function buildInviteLink(agreementId, kind, index, privateKey) {
  return `${window.location.origin}/agreement/${agreementId}#invite=${privateKey}&kind=${kind}&i=${index}`
}

export function parseInviteFromHash() {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const privateKey = params.get('invite')
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) return null
  const kind = params.get('kind') === 'member' ? 'member' : 'party'
  const index = Number(params.get('i'))
  if (!Number.isInteger(index) || index < 0) return null
  return { privateKey, kind, index }
}

export function clearInviteFromUrl() {
  window.history.replaceState(null, '', window.location.pathname)
}

// Creator keeps a copy of invite keys on this device so they can re-share links
const inviteStoreKey = (id) => `lexchain-v4-invites-${id}`

export function saveInvite(agreementId, kind, index, privateKey) {
  try {
    const all = JSON.parse(localStorage.getItem(inviteStoreKey(agreementId)) || '{}')
    all[`${kind}:${index}`] = privateKey
    localStorage.setItem(inviteStoreKey(agreementId), JSON.stringify(all))
  } catch { /* storage unavailable */ }
}

export function loadInvites(agreementId) {
  try {
    return JSON.parse(localStorage.getItem(inviteStoreKey(agreementId)) || '{}')
  } catch {
    return {}
  }
}

// ============ FRIENDLY ERRORS ============
const CONTRACT_ERRORS = {
  NotFound: "This agreement doesn't exist. Please check the link.",
  NotAuthorized: "You don't have permission to do this on this agreement.",
  InvalidState: "This isn't possible right now — the agreement's status has changed. Refresh the page and try again.",
  InvalidInput: 'Some details are missing or invalid. Please check the form.',
  AlreadySigned: "You've already signed this version.",
  AlreadyDone: 'This has already been done — for example, the invite was already used.',
  InsufficientCredits: "You've run out of agreement credits.",
  InvalidInvite: "This invite link isn't valid for your account. Ask the sender for a fresh link.",
  TooManyParties: 'An agreement can have at most 20 parties.',
  SlugTaken: 'That business URL is already taken — try another one.',
  AlreadyRegistered: 'This account already has a registered business.',
  EnforcedPause: 'LexChain is paused for maintenance. Please try again shortly.',
}

const SELECTORS = Object.keys(CONTRACT_ERRORS).map(name => ({
  name,
  selector: toFunctionSelector(`${name}()`).toLowerCase(),
}))

export function friendlyError(err) {
  const text = [err?.shortMessage, err?.message, err?.details, err?.cause?.message, err?.cause?.shortMessage]
    .filter(Boolean)
    .join(' ')
  const lower = text.toLowerCase()

  for (const name of Object.keys(CONTRACT_ERRORS)) {
    if (text.includes(name)) return CONTRACT_ERRORS[name]
  }
  for (const { name, selector } of SELECTORS) {
    if (lower.includes(selector)) return CONTRACT_ERRORS[name]
  }

  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')) {
    return 'You cancelled the request.'
  }
  if (lower.includes('insufficient funds') || lower.includes('paymaster') || lower.includes('sponsorship')) {
    return "Free transactions aren't available right now. Please try again in a few minutes."
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Network problem — please check your connection and try again.'
  }
  if (lower.includes('session') || lower.includes('sign in')) {
    return 'Your session expired. Please sign out and sign in again.'
  }
  return err?.shortMessage || err?.message || 'Something went wrong. Please try again.'
}