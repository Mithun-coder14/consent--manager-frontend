import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useReadContract } from 'wagmi'
import { encodeFunctionData } from 'viem'
import { AGREEMENT_REGISTRY_ADDRESS, AGREEMENT_REGISTRY_ABI } from '../contracts/config'
import { summarizeTandC } from '../groq'
import { useLexWallet } from '../useLexWallet'

const STATUS_MAP = {
  0: { label: 'Draft', class: 'badge-purple' },
  1: { label: 'Pending Signatures', class: 'badge-amber' },
  2: { label: 'Active', class: 'badge-green' },
  3: { label: 'Expired', class: 'badge-red' },
  4: { label: 'Declined', class: 'badge-red' },
  5: { label: 'Cancelled', class: 'badge-red' },
}

const TYPE_ICONS = {
  tandc: '📋', rental: '🏠', employment: '💼',
  nda: '🔒', freelance: '💻', insurance: '🛡️',
  lease: '🔑', partnership: '🤝',
}

function AgreementView({ agreementId: propId }) {
  const params = useParams()
  const navigate = useNavigate()
  const agreementId = propId || params.id
  const { address, sendTx, ready } = useLexWallet()

  const [isPending, setIsPending] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [summarizing, setSummarizing] = useState(false)
  const [aiSummary, setAiSummary] = useState(null)
  const [copied, setCopied] = useState(false)

  const { data: agreement, refetch } = useReadContract({
    address: AGREEMENT_REGISTRY_ADDRESS,
    abi: AGREEMENT_REGISTRY_ABI,
    functionName: 'getAgreement',
    args: [agreementId],
    query: { enabled: !!agreementId },
  })

  const runAction = async (functionName, successText) => {
    setError(null)
    setMessage(null)
    setIsPending(true)
    try {
      const data = encodeFunctionData({
        abi: AGREEMENT_REGISTRY_ABI,
        functionName,
        args: [agreementId],
      })
      await sendTx({ to: AGREEMENT_REGISTRY_ADDRESS, data })
      setMessage(successText)
      await refetch()
    } catch (err) {
      console.error(`${functionName} error:`, err)
      setError(err.shortMessage || err.message)
    } finally {
      setIsPending(false)
    }
  }

  const handleSummarize = async () => {
    if (!agreement?.ipfsCID) return
    setSummarizing(true)
    try {
      const response = await fetch(`https://gateway.pinata.cloud/ipfs/${agreement.ipfsCID}`)
      const text = await response.text()
      setAiSummary(await summarizeTandC(text))
    } catch {
      alert('Could not summarize document')
    } finally {
      setSummarizing(false)
    }
  }

  const copyShareLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/agreement/${agreementId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const backButton = (
    <button className="btn btn-outline" style={{ marginBottom: '16px', padding: '6px 14px', fontSize: '12px' }}
      onClick={() => navigate('/')}>
      ← Back to dashboard
    </button>
  )

  if (!agreement) return (
    <div>
      {backButton}
      <div className="empty-state"><p className="pulse">Loading agreement...</p></div>
    </div>
  )

  const status = Number(agreement.status)
  const isPartyA = agreement.partyA?.toLowerCase() === address?.toLowerCase()
  const isPartyB = agreement.partyB?.toLowerCase() === address?.toLowerCase()
  const isParty = isPartyA || isPartyB
  const hasISigned = isPartyA ? agreement.signedByA : isPartyB ? agreement.signedByB : false
  const endDate = new Date(Number(agreement.endDate) * 1000).toLocaleDateString()
  const createdAt = new Date(Number(agreement.createdAt) * 1000).toLocaleDateString()

  return (
    <div>
      {backButton}

      <div className="card card-glow" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '32px' }}>{TYPE_ICONS[agreement.agreementType] || '📄'}</span>
            <div>
              <p style={{ fontWeight: '700', fontSize: '18px' }}>{agreement.title}</p>
              {agreement.description && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{agreement.description}</p>
              )}
            </div>
          </div>
          <span className={`badge ${STATUS_MAP[status]?.class}`}>{STATUS_MAP[status]?.label}</span>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          {[
            { label: 'PARTY A', name: agreement.partyAName, signed: agreement.signedByA, me: isPartyA },
            { label: 'PARTY B', name: agreement.partyBName, signed: agreement.signedByB, me: isPartyB },
          ].map(p => (
            <div key={p.label} style={{
              flex: 1, padding: '12px', borderRadius: '10px',
              background: p.signed ? 'var(--green-dim)' : 'var(--bg-card)',
              border: `1px solid ${p.signed ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
            }}>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {p.label}{p.me ? ' · YOU' : ''}
              </p>
              <p style={{ fontSize: '13px', fontWeight: '600' }}>{p.name}</p>
              <p style={{ fontSize: '11px', color: p.signed ? 'var(--green)' : 'var(--amber)', marginTop: '4px' }}>
                {p.signed ? '✓ Signed' : '○ Pending'}
              </p>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '16px' }}>
          {[
            { label: 'Created', value: createdAt },
            { label: 'Expires', value: endDate },
            { label: 'Type', value: agreement.agreementType },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Document</span>
            <a href={`https://gateway.pinata.cloud/ipfs/${agreement.ipfsCID}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '12px', color: 'var(--purple-bright)' }}>View on IPFS ↗</a>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Blockchain proof</span>
            <a href={`https://basescan.org/address/${AGREEMENT_REGISTRY_ADDRESS}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '12px', color: 'var(--purple-bright)' }}>View on Basescan ↗</a>
          </div>
        </div>

        <button className="btn btn-outline" style={{ width: '100%', marginBottom: '12px' }} onClick={copyShareLink}>
          {copied ? '✅ Link copied!' : '🔗 Copy shareable link'}
        </button>

        <button className="btn btn-outline" style={{ width: '100%', marginBottom: '12px' }}
          onClick={handleSummarize} disabled={summarizing}>
          {summarizing ? <span className="pulse">🤖 AI analyzing...</span> : '🤖 Explain in plain English'}
        </button>

        {aiSummary && (
          <div style={{
            padding: '12px', borderRadius: '10px', background: 'var(--purple-dim)',
            border: '1px solid rgba(139,92,246,0.2)', marginBottom: '12px',
          }}>
            <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: '1.6', marginBottom: '8px' }}>
              {aiSummary.summary}
            </p>
            <span className={`badge ${aiSummary.risk_level === 'High' ? 'badge-red' : aiSummary.risk_level === 'Medium' ? 'badge-amber' : 'badge-green'}`}>
              Risk: {aiSummary.risk_level}
            </span>
          </div>
        )}

        {status === 1 && isParty && !hasISigned && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {isPartyB && (
              <button className="btn btn-danger" style={{ flex: 1 }} disabled={isPending || !ready}
                onClick={() => runAction('declineAgreement', 'Agreement declined.')}>
                Decline
              </button>
            )}
            <button className="btn btn-primary" style={{ flex: 2 }} disabled={isPending || !ready}
              onClick={() => runAction('signAgreement', 'Signed on Base — free!')}>
              {!ready ? <span className="pulse">⏳ Preparing wallet...</span>
                : isPending ? <span className="pulse">⏳ Signing...</span>
                : '✍️ Sign Agreement — free'}
            </button>
          </div>
        )}

        {status === 1 && isPartyA && !agreement.signedByA && (
          <button className="btn btn-danger" style={{ width: '100%', marginTop: '8px' }} disabled={isPending || !ready}
            onClick={() => runAction('cancelAgreement', 'Agreement cancelled.')}>
            Cancel Agreement
          </button>
        )}

        {status === 1 && hasISigned && (
          <div className="tx-status success"><span>✅</span><span>You have signed. Waiting for the other party.</span></div>
        )}

        {status === 2 && (
          <div className="tx-status success"><span>✅</span><span>Agreement is active and legally binding on blockchain.</span></div>
        )}

        {status === 1 && !isParty && address && (
          <div className="tx-status pending">
            <span>ℹ️</span>
            <span style={{ fontSize: '12px' }}>You're viewing this agreement but you're not one of the signing parties.</span>
          </div>
        )}

        {message && (
          <div className="tx-status success" style={{ marginTop: '12px' }}><span>✅</span><span>{message}</span></div>
        )}

        {error && (
          <div className="tx-status error" style={{ marginTop: '12px' }}>
            <span>❌</span><span style={{ fontSize: '12px', wordBreak: 'break-word' }}>{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default AgreementView