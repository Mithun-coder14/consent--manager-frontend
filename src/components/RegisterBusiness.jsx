import { useState } from 'react'
import { useWallets } from '@privy-io/react-auth'
import { createPublicClient, http, encodeFunctionData } from 'viem'
import { base } from 'viem/chains'
import { AGREEMENT_REGISTRY_ADDRESS, AGREEMENT_REGISTRY_ABI } from '../contracts/config'

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
})

function RegisterBusiness() {
  const { wallets } = useWallets()
  const [form, setForm] = useState({ name: '', slug: '', logo: '' })
  const [isPending, setIsPending] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState(null)

  const handleSlugChange = (e) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setForm(f => ({ ...f, slug: val }))
  }

  const handleRegister = async () => {
    if (!form.name || !form.slug) {
      alert('Please fill in name and slug')
      return
    }

    setIsPending(true)
    setError(null)

    try {
      const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')
      const wallet = embeddedWallet || wallets[0]

      if (!wallet) {
        setError('No wallet found. Please sign out and sign back in.')
        setIsPending(false)
        return
      }

      const data = encodeFunctionData({
        abi: AGREEMENT_REGISTRY_ABI,
        functionName: 'registerBusiness',
        args: [form.name, form.slug, form.logo || ''],
      })

      const provider = await wallet.getEthereumProvider()

      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: wallet.address,
          to: AGREEMENT_REGISTRY_ADDRESS,
          data: data,
        }],
      })

      console.log('TX Hash:', txHash)
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      console.log('Receipt:', receipt)
      setIsSuccess(true)

    } catch (err) {
      console.error('Error:', err)
      setError(err.message)
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
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Users can now find you as <strong>{form.slug}</strong>
        </p>
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
          placeholder="e.g. nexatech"
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
          <span style={{ fontSize: '12px' }}>{error}</span>
        </div>
      )}

      <button
        className="btn btn-primary"
        style={{ width: '100%' }}
        onClick={handleRegister}
        disabled={isPending}
      >
        {isPending
          ? <span className="pulse">⏳ Registering...</span>
          : '⚡ Register Business'
        }
      </button>

      {wallets.length === 0 && (
        <p style={{ fontSize: '12px', color: 'var(--amber)', marginTop: '12px', textAlign: 'center' }}>
          ⚠️ No wallet detected. Sign out and sign back in.
        </p>
      )}
    </div>
  )
}

export default RegisterBusiness