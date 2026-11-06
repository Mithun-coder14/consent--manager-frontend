import { PinataSDK } from 'pinata'
import { getAccessToken } from '@privy-io/react-auth'

const GATEWAY = import.meta.env.VITE_PINATA_GATEWAY

const pinata = new PinataSDK({ pinataJwt: '', pinataGateway: GATEWAY })

export function ipfsUrl(cid) {
  return GATEWAY ? `https://${GATEWAY}/ipfs/${cid}` : `https://ipfs.io/ipfs/${cid}`
}

const FALLBACK_GATEWAYS = [
  (cid) => ipfsUrl(cid),
  (cid) => `https://ipfs.io/ipfs/${cid}`,
  (cid) => `https://dweb.link/ipfs/${cid}`,
]

export async function fetchFromIPFS(cid) {
  let lastError = null
  for (const build of FALLBACK_GATEWAYS) {
    const url = build(cid)
    try {
      const response = await fetch(url)
      if (response.ok) return response
      lastError = new Error(`${url} → ${response.status}`)
    } catch (err) {
      lastError = err
    }
  }
  throw new Error(`Could not load document from IPFS. Last error: ${lastError?.message}`)
}

export async function uploadToPinata(file) {
  const token = await getAccessToken()
  const response = await fetch('/api/upload-url', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Could not prepare the upload.')

  const upload = await pinata.upload.public.file(file).url(data.url)
  return { cid: upload.cid, url: ipfsUrl(upload.cid) }
}

export async function generateContentHash(file) {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}