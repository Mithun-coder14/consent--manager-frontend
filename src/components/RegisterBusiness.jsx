import { useState } from 'react'
import { encodeFunctionData } from 'viem'
import { AGREEMENT_REGISTRY_ADDRESS, AGREEMENT_REGISTRY_ABI } from '../contracts/config'
import { useLexWallet } from '../useLexWallet'

function RegisterBusiness() {
  const { address, sendTx, ready } = useLexWallet()
  const [form, setForm] = useState({ name: '', slug: '', logo: '' })
  const [isPending, setIsPending] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [error, setError] = useState(null)

  const handleSlugChange = (e) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setForm(f => ({ ...f, slug: val }))
  }

  const handleRegister = async () => {
    setError(null)
    if (!form.name || !form.slug) {
      setError('Please fill in name and slug')
      return
    }

    setIsPending(true)
    try {
      const data = encodeFunctionData({
        abi: AGREEMENT_REGISTRY_ABI,
        functionName: 'registerBusiness',
        args: [form.name, form.slug, form.logo || ''],
      })
      const hash = await sendTx({ to: AGREEMENT_REGISTRY_ADDRESS, data })
      setTxHash(hash)
      setIsSuccess(true)
    } catch (err) {
      console.error('Register error:', err)
      setError(err.shortMessage || err.message)
    } finally {
      setIsPending(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="card card-glow" style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</p>
        <p style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
          Business Registered!
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Users can now find you as <strong>{form.slug}</strong>
        </p>
        <a
          href={`https://basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '12px', color: 'var(--purple-bright)' }}
        >
          View transaction on Basescan ↗
        </a>
      </div>
    )
  }

  return (
    <div className="card">
      <p className="section-title">Register your business</p>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Register once — users can find you by name instead of wallet address.
      </p>

      <div style={{ marginBottom: '12px' }}>
        <label className="label">Business Name</label>
        <input
          className="input"
          placeholder="e.g. NexaTech Solutions"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label className="label">Unique Slug (your URL)</label>
        <input
          className="input"
          placeholder="e.g. nexatech2"
          value={form.slug}
          onChange={handleSlugChange}
        />
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Lowercase letters, numbers and hyphens only
        </p>
      </div>

      {error && (
        <div className="tx-status error" style={{ marginBottom: '12px' }}>
          <span>❌</span>
          <span style={{ fontSize: '12px', wordBreak: 'break-word' }}>{error}</span>
        </div>
      )}

      <button
        className="btn btn-primary"
        style={{ width: '100%' }}
        onClick={handleRegister}
        disabled={isPending || !ready}
      >
        {!ready
          ? <span className="pulse">⏳ Preparing wallet...</span>
          : isPending
            ? <span className="pulse">⏳ Registering...</span>
            : '⚡ Register Business — free'}
      </button>

      {address && (
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'center', fontFamily: 'monospace' }}>
          Smart wallet: {address}
        </p>
      )}
    </div>
  )
}

export default RegisterBusiness