import { PinataSDK } from "pinata"

const pinata = new PinataSDK({
  pinataJwt: import.meta.env.VITE_PINATA_JWT,
})

export async function uploadToPinata(file) {
  try {
    const upload = await pinata.upload.public.file(file)
    return {
      cid: upload.cid,
      url: `https://gateway.pinata.cloud/ipfs/${upload.cid}`
    }
  } catch (error) {
    console.error("Pinata upload error:", error)
    throw error
  }
}

export async function generateContentHash(file) {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}