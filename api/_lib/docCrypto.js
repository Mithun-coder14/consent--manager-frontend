import { createHmac, randomBytes } from 'crypto'

export function newKeyId() {
  return randomBytes(16).toString('hex')
}

// Same keyId always produces the same key — no database needed
export function deriveKey(keyIdHex) {
  const master = process.env.DOC_MASTER_KEY
  if (!master || master.length !== 64) throw new Error('Server encryption is not configured.')
  return createHmac('sha256', Buffer.from(master, 'hex'))
    .update(`LEXCHAIN_DOC_V1:${keyIdHex}`)
    .digest()
}

export function viewAccessMessage(agreementId, kind, index) {
  return `LexChain document access\nAgreement: ${agreementId.toLowerCase()}\nSlot: ${kind}:${index}`
}

// Reads the key ID stored in the first bytes of an encrypted file on IPFS
export async function readKeyIdFromIPFS(cid) {
  try {
    const response = await fetch(`https://${process.env.PINATA_GATEWAY}/ipfs/${cid}`, {
      headers: { Range: 'bytes=0-19' },
    })
    if (!response.ok) return null
    const buf = Buffer.from(await response.arrayBuffer())
    if (buf.length < 20 || buf.subarray(0, 4).toString('utf8') !== 'LXC1') return null
    return buf.subarray(4, 20).toString('hex')
  } catch {
    return null
  }
}