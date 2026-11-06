import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useReadContract } from 'wagmi'
import { encodeFunctionData, zeroAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { AGREEMENT_REGISTRY_ADDRESS, AGREEMENT_REGISTRY_ABI } from '../contracts/config'
import { summarizeTandC } from '../groq'
import { useLexWallet, publicClient } from '../useLexWallet'
import { ipfsUrl, fetchFromIPFS } from '../pinata'
import { extractText } from '../extractText'

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

function readInviteFromUrl() {
  const match = window.location.hash.match(/invite=(0x[0-9a-fA-F]{64})/)
  return match ? match[1] : null
}

function readStoredInvite(id) {
  try { return localStorage.getItem(`lexchain-invite-${id}`) } catch { return null }
}

function AgreementView({ agreementId: propId }) {
  const params = useParams()
  const navigate = useNavigate()
  const agreementId = propId || params.id
  const { address, sendTx, ready } = useLexWallet()

  const [inviteKey] = useState(readInviteFromUrl)
  const [storedInvite] = useState(() => readStoredInvite(agreementId))
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
      const data = encodeFunctionData({ abi: AGREEMENT_REGISTRY_ABI, functionName, args: [agreementId] })
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

  const handleClaimAndSign = async () => {
    setError(null)
    setMessage(null)
    setIsPending(true)
    try {
      // 1. Ask the contract what the invite key must sign for THIS wallet
      const digest = await publicClient.readContract({
        address: AGREEMENT_REGISTRY_ADDRESS,
        abi: AGREEMENT_REGISTRY_ABI,
        functionName: 'getInviteDigest',
        args: [agreementId, address],
      })

      // 2. Invite key authorizes this wallet as Party B (happens locally, nothing sent)
      const inviteSignature = await privateKeyToAccount(inviteKey).signMessage({ message: { raw: digest } })

      // 3. Claim + sign in one sponsored transaction
      const data = encodeFunctionData({
        abi: AGREEMENT_REGISTRY_ABI,
        functionName: 'claimAndSign',
        args: [agreementId, inviteSignature],
      })
      await sendTx({ to: AGREEMENT_REGISTRY_ADDRESS, data })

      // Remove the used invite from the URL
      window.history.replaceState(null, '', window.location.pathname)
      setMessage('Signed on Base — free!')
      await refetch()
    } catch (err) {
      console.error('claimAndSign error:', err)
      setError(err.shortMessage || err.message)
    } finally {
      setIsPending(false)
    }
  }

    const handleSummarize = async () => {
    if (!agreement?.ipfsCID) return
    setSummarizing(true)
    try {
      const response = await fetchFromIPFS(agreement.ipfsCID)
      const text = await extractText(await response.arrayBuffer())
      setAiSummary(await summarizeTandC(text))
    } catch (err) {
      console.error('Summarize error:', err)
      alert('Could not summarize: ' + err.message)
    } finally {
      setSummarizing(false)
    }
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
  const pending = status === 1
  const unclaimed = agreement.partyB?.toLowerCase() === zeroAddress
  const isPartyA = agreement.partyA?.toLowerCase() === address?.toLowerCase()
  const isPartyB = !unclaimed && agreement.partyB?.toLowerCase() === address?.toLowerCase()

  const canSignA = pending && isPartyA && !agreement.signedByA
  const canSignB = pending && isPartyB && !agreement.signedByB
  const canClaim = pending && unclaimed && !!inviteKey && !isPartyA
  const canDecline = pending && isPartyB && !agreement.signedByB
  const canCancel = pending && isPartyA

  const shareLink = isPartyA && unclaimed && storedInvite
    ? `${window.location.origin}/agreement/${agreementId}#invite=${storedInvite}`
    : `${window.location.origin}/agreement/${agreementId}`

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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

        {/* Parties */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          {[
            { label: 'PARTY A', name: agreement.partyAName, signed: agreement.signedByA, me: isPartyA, note: '' },
            { label: 'PARTY B', name: agreement.partyBName || 'Invited party', signed: agreement.signedByB,
              me: isPartyB, note: unclaimed ? 'Invite not opened yet' : '' },
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
              {p.note && <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{p.note}</p>}
            </div>
          ))}
        </div>

        {/* Details */}
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
            <a href={ipfsUrl(agreement.ipfsCID)} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '12px', color: 'var(--purple-bright)' }}>View on IPFS ↗</a>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Blockchain proof</span>
            <a href={`https://basescan.org/address/${AGREEMENT_REGISTRY_ADDRESS}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '12px', color: 'var(--purple-bright)' }}>View on Basescan ↗</a>
          </div>
        </div>

        {/* Share */}
        {isPartyA && (
          <button className="btn btn-outline" style={{ width: '100%', marginBottom: '12px' }} onClick={copyShareLink}>
            {copied ? '✅ Link copied!' : unclaimed && storedInvite ? '🔗 Copy invite link' : '🔗 Copy agreement link'}
          </button>
        )}
        {isPartyA && unclaimed && !storedInvite && pending && (
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', textAlign: 'center' }}>
            The invite link was created on another device — use the link you saved when you created this agreement.
          </p>
        )}

        {/* AI */}
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

        {/* Actions */}
        {canClaim && (
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={isPending || !ready || !address}
            onClick={handleClaimAndSign}>
            {!ready ? <span className="pulse">⏳ Preparing wallet...</span>
              : isPending ? <span className="pulse">⏳ Signing...</span>
              : `✍️ Sign as ${agreement.partyBName || 'Party B'} — free`}
          </button>
        )}

        {(canSignA || canSignB || canDecline) && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {canDecline && (
              <button className="btn btn-danger" style={{ flex: 1 }} disabled={isPending || !ready}
                onClick={() => runAction('declineAgreement', 'Agreement declined.')}>
                Decline
              </button>
            )}
            {(canSignA || canSignB) && (
              <button className="btn btn-primary" style={{ flex: 2 }} disabled={isPending || !ready}
                onClick={() => runAction('signAgreement', 'Signed on Base — free!')}>
                {!ready ? <span className="pulse">⏳ Preparing wallet...</span>
                  : isPending ? <span className="pulse">⏳ Signing...</span>
                  : '✍️ Sign Agreement — free'}
              </button>
            )}
          </div>
        )}

        {canCancel && (
          <button className="btn btn-danger" style={{ width: '100%', marginTop: '8px' }} disabled={isPending || !ready}
            onClick={() => { if (confirm('Cancel this agreement? This cannot be undone.')) runAction('cancelAgreement', 'Agreement cancelled.') }}>
            Cancel Agreement
          </button>
        )}

        {/* Status messages */}
        {pending && isPartyA && agreement.signedByA && (
          <div className="tx-status success" style={{ marginTop: '12px' }}>
            <span>✅</span>
            <span>{unclaimed ? 'You have signed. Send the invite link to the other party.' : 'You have signed. Waiting for the other party.'}</span>
          </div>
        )}

        {pending && isPartyB && agreement.signedByB && (
          <div className="tx-status success" style={{ marginTop: '12px' }}>
            <span>✅</span><span>You have signed. Waiting for {agreement.partyAName} to sign.</span>
          </div>
        )}

        {status === 2 && (
          <div className="tx-status success" style={{ marginTop: '12px' }}>
            <span>✅</span><span>Agreement is active and legally binding on blockchain.</span>
          </div>
        )}

        {pending && unclaimed && !inviteKey && !isPartyA && (
          <div className="tx-status pending" style={{ marginTop: '12px' }}>
            <span>ℹ️</span>
            <span style={{ fontSize: '12px' }}>This agreement is waiting for its invited party. Open the exact invite link you received.</span>
          </div>
        )}

        {pending && !unclaimed && !isPartyA && !isPartyB && address && (
          <div className="tx-status pending" style={{ marginTop: '12px' }}>
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