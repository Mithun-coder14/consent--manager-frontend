import { PinataSDK } from 'pinata'
import { requireUser } from './_lib/auth.js'

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
})

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireUser(req, res)
  if (!user) return

  try {
    const url = await pinata.upload.public.createSignedURL({ expires: 120 })
    return res.status(200).json({ url })
  } catch (err) {
    console.error('Signed URL error:', err)
    return res.status(500).json({ error: 'Could not prepare the upload. Please try again.' })
  }
}