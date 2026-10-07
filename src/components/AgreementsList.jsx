import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { AGREEMENT_REGISTRY_ADDRESS, AGREEMENT_REGISTRY_ABI } from '../contracts/config'
import { summarizeTandC } from '../groq'

const STATUS_MAP = {
  0: { label: 'Draft', class: 'badge-purple' },
  1: { label: 'Pending', class: 'badge-amber' },
  2: { label: 'Active', class: 'badge-green' },
  3: { label: 'Expired', class: 'badge-red' },
  4: { label: 'Declined', class: 'badge-red' },
  5: { label: 'Cancelled', class: 'badge-red' },
}

const TYPE_ICONS = {
  tandc: '📋', rental: '🏠', employment: '💼',
  nda: '🔒', freelance: '💻', insurance: '🛡️',
  lease: '🔑', partnership: '🤝'
}

function AgreementCard({ agreementId, currentAddress }) {
  const [expanded, setExpanded] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [aiSummary, setAiSummary] = useState(null)

  const { data: agreement } = useReadContract({
    address: AGREEMENT_REGISTRY_ADDRESS,
    abi: AGREEMENT_REGISTRY_ABI,
    functionName: 'getAgreement',
    args: [agreementId],
  })

  const { writeContract, isPending, data: txHash } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const handleSign = () => {
    writeContract({
      address: AGREEMENT_REGISTRY_ADDRESS,
      abi: AGREEMENT_REGISTRY_ABI,
      functionName: 'signAgreement',
      args: [agreementId],
    })
  }

  const handleDecline = () => {
    writeContract({
      address: AGREEMENT_REGISTRY_ADDRESS,
      abi: AGREEMENT_REGISTRY_ABI,
      functionName: 'declineAgreement',
      args: [agreementId],
    })
  }

  const handleCancel = () => {
    writeContract({
      address: AGREEMENT_REGISTRY_ADDRESS,
      abi: AGREEMENT_REGISTRY_ABI,
      functionName: 'cancelAgreement',
      args: [agreementId],
    })
  }

  const handleSummarize = async () => {
    if (!agreement?.ipfsCID) return
    setSummarizing(true)
    try {
      const url = `https://gateway.pinata.cloud/ipfs/${agreement.ipfsCID}`
      const response = await fetch(url)
      const text = await response.text()
      const summary = await summarizeTandC(text)
      setAiSummary(summary)
    } catch (e) {
      alert('Could not fetch or summarize document')
    } finally {
      setSummarizing(false)
    }
  }

  if (!agreement) return (
    <div className="card" style={{ opacity: 0.5 }}>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }} className="pulse">Loading...</p>
    </div>
  )

  const isPartyA = agreement.partyA?.toLowerCase() === currentAddress?.toLowerCase()
  const isPartyB = agreement.partyB?.toLowerCase() === currentAddress?.toLowerCase()
  const hasISigned = isPartyA ? agreement.signedByA : agreement.signedByB
  const status = Number(agreement.status)
  const endDate = new Date(Number(agreement.endDate) * 1000).toLocaleDateString()
  const createdAt = new Date(Number(agreement.createdAt) * 1000).toLocaleDateString()

  return (
    <div className="card" style={{ marginBottom: '12px' }}>
      {/* Header */}
      <div
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>{TYPE_ICONS[agreement.agreementType] || '📄'}</span>
            <div>
              <p style={{ fontWeight: '600', fontSize: '14px' }}>{agreement.title}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {isPartyA ? `With: ${agreement.partyBName}` : `From: ${agreement.partyAName}`}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <span className={`badge ${STATUS_MAP[status]?.class}`}>
              {STATUS_MAP[status]?.label}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {expanded ? '▲' : '▼'}
            </span>
          </div>
        </div>

        {/* Signing status */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className={`badge ${agreement.signedByA ? 'badge-green' : 'badge-amber'}`}>
            {agreement.signedByA ? '✓' : '○'} {agreement.partyAName || 'Party A'}
          </span>
          <span className={`badge ${agreement.signedByB ? 'badge-green' : 'badge-amber'}`}>
            {agreement.signedByB ? '✓' : '○'} {agreement.partyBName || 'Party B'}
          </span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: '16px' }}>
          <div className="divider" />

          <div style={{ marginTop: '16px' }}>
            {[
              { label: 'Created', value: createdAt },
              { label: 'Expires', value: endDate },
              { label: 'Type', value: agreement.agreementType },
            ].map(({ label, value }) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{value}</span>
              </div>
            ))}

            {/* IPFS document link */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Document</span>
              <a
                href={`https://gateway.pinata.cloud/ipfs/${agreement.ipfsCID}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '12px', color: 'var(--purple-bright)' }}
              >
                View on IPFS ↗
              </a>
            </div>

            {/* Basescan link */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Blockchain proof</span>
              <a
                href={`https://basescan.org/address/${AGREEMENT_REGISTRY_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '12px', color: 'var(--purple-bright)' }}
              >
                View on Basescan ↗
              </a>
            </div>
          </div>

          {/* AI Summary */}
          <button
            className="btn btn-outline"
            style={{ width: '100%', marginBottom: '12px' }}
            onClick={handleSummarize}
            disabled={summarizing}
          >
            {summarizing
              ? <span className="pulse">🤖 AI analyzing...</span>
              : '🤖 Explain this agreement in plain English'
            }
          </button>

          {aiSummary && (
            <div style={{
              padding: '12px', borderRadius: '10px',
              background: 'var(--purple-dim)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              marginBottom: '12px'
            }}>
              <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: '1.6', marginBottom: '8px' }}>
                {aiSummary.summary}
              </p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span className={`badge ${aiSummary.risk_level === 'High' ? 'badge-red' : aiSummary.risk_level === 'Medium' ? 'badge-amber' : 'badge-green'}`}>
                  Risk: {aiSummary.risk_level}
                </span>
                {aiSummary.key_concerns?.map((c, i) => (
                  <span key={i} className="badge badge-amber">⚠️ {c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {status === 1 && !hasISigned && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {isPartyB && (
                <button
                  className="btn btn-danger"
                  style={{ flex: 1 }}
                  onClick={handleDecline}
                  disabled={isPending}
                >
                  Decline
                </button>
              )}
              <button
                className="btn btn-primary"
                style={{ flex: 2 }}
                onClick={handleSign}
                disabled={isPending}
              >
                {isPending
                  ? <span className="pulse">⏳ Signing...</span>
                  : '✍️ Sign Agreement'
                }
              </button>
            </div>
          )}

          {status === 1 && isPartyA && !agreement.signedByA && (
            <button
              className="btn btn-danger"
              style={{ width: '100%', marginTop: '8px' }}
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancel Agreement
            </button>
          )}

          {hasISigned && status === 1 && (
            <div className="tx-status success">
              <span>✅</span>
              <span>You have signed. Waiting for the other party.</span>
            </div>
          )}

          {status === 2 && (
            <div className="tx-status success">
              <span>✅</span>
              <span>Agreement is active and legally binding on blockchain.</span>
            </div>
          )}

          {isSuccess && (
            <div className="tx-status success">
              <span>✅</span>
              <span>Transaction confirmed on Base!</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AgreementsList() {
  const { address } = useAccount()

  const { data: agreementIds, isLoading } = useReadContract({
    address: AGREEMENT_REGISTRY_ADDRESS,
    abi: AGREEMENT_REGISTRY_ABI,
    functionName: 'getAgreementsByParty',
    args: [address],
    query: { enabled: !!address }
  })

  if (isLoading) return (
    <div className="empty-state">
      <p className="pulse" style={{ fontSize: '14px' }}>Loading agreements...</p>
    </div>
  )

  if (!agreementIds || agreementIds.length === 0) return (
    <div className="empty-state">
      <div className="icon">📄</div>
      <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)', marginBottom: '8px' }}>
        No agreements yet
      </p>
      <p>Create your first agreement or wait for someone to send you one.</p>
    </div>
  )

  return (
    <div>
      <p className="section-title" style={{ marginBottom: '16px' }}>
        {agreementIds.length} Agreement{agreementIds.length !== 1 ? 's' : ''}
      </p>
      {[...agreementIds].reverse().map(id => (
        <AgreementCard
          key={id}
          agreementId={id}
          currentAddress={address}
        />
      ))}
    </div>
  )
}

export default AgreementsList