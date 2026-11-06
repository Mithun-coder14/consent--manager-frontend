import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReadContract } from 'wagmi'
import { encodeFunctionData, parseEventLogs, zeroAddress } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { AGREEMENT_REGISTRY_ADDRESS, AGREEMENT_REGISTRY_ABI } from '../contracts/config'
import { uploadToPinata, generateContentHash } from '../pinata'
import { summarizeTandC } from '../groq'
import { useLexWallet, publicClient } from '../useLexWallet'
import { extractText } from '../extractText'
const AGREEMENT_TYPES = [
  { id: 'tandc', label: 'T&C / Privacy Policy', icon: '📋' },
  { id: 'rental', label: 'Rental Agreement', icon: '🏠' },
  { id: 'employment', label: 'Employment Contract', icon: '💼' },
  { id: 'nda', label: 'NDA', icon: '🔒' },
  { id: 'freelance', label: 'Freelance Contract', icon: '💻' },
  { id: 'insurance', label: 'Insurance Policy', icon: '🛡️' },
  { id: 'lease', label: 'Lease Agreement', icon: '🔑' },
  { id: 'partnership', label: 'Partnership Agreement', icon: '🤝' },
]

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000'

function CreateAgreement() {
  const navigate = useNavigate()
  const { address, sendTx, ready } = useLexWallet()
  const [step, setStep] = useState(1)
  const [agreementType, setAgreementType] = useState('')
  const [form, setForm] = useState({
    title: '', description: '', partyBAddress: '', partyBName: '', endDate: '',
  })
  const [partyMode, setPartyMode] = useState('invite') // 'invite' | 'wallet'
  const [signNow, setSignNow] = useState(true)

  const [file, setFile] = useState(null)
  const [fileText, setFileText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadedCID, setUploadedCID] = useState('')
  const [uploadedHash, setUploadedHash] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [aiSummary, setAiSummary] = useState(null)

  const [searchSlug, setSearchSlug] = useState('')
  const [foundBusiness, setFoundBusiness] = useState(null)
  const [searching, setSearching] = useState(false)

  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null) // { id, link, isInvite, txHash }
  const [linkCopied, setLinkCopied] = useState(false)

  const { refetch: searchBusiness } = useReadContract({
    address: AGREEMENT_REGISTRY_ADDRESS,
    abi: AGREEMENT_REGISTRY_ABI,
    functionName: 'getBusinessBySlug',
    args: [searchSlug],
    query: { enabled: false },
  })

  const handleSearchBusiness = async () => {
    if (!searchSlug) return
    setSearching(true)
    setFoundBusiness(null)
    try {
      const result = await searchBusiness()
      if (result.data) {
        setFoundBusiness(result.data)
        setForm(f => ({ ...f, partyBAddress: result.data.wallet, partyBName: result.data.name }))
      } else {
        alert('Business not found')
      }
    } catch {
      alert('Business not found')
    }
    setSearching(false)
  }

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return
    setFile(selectedFile)
    setUploading(true)
    setUploadSuccess(false)
    setAiSummary(null)
    try {
      setUploadedHash(await generateContentHash(selectedFile))
      const result = await uploadToPinata(selectedFile)
      setUploadedCID(result.cid)
      
      setUploadSuccess(true)
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSummarize = async () => {
    if (!file) return
    setSummarizing(true)
    try {
      const text = await extractText(await file.arrayBuffer())
      setAiSummary(await summarizeTandC(text))
    } catch (err) {
      alert('AI summarization failed: ' + err.message)
    } finally {
      setSummarizing(false)
    }
  }

  const handleCreate = async () => {
    setError(null)

    if (!form.title || !uploadedCID || !form.endDate) {
      setError('Please complete all fields')
      return
    }
    if (partyMode === 'invite' && !form.partyBName.trim()) {
      setError("Please enter the other party's name")
      return
    }
    if (partyMode === 'wallet') {
      if (!form.partyBAddress.trim()) {
        setError("Please enter the other party's wallet address")
        return
      }
      if (address && address.toLowerCase() === form.partyBAddress.trim().toLowerCase()) {
        setError('Party B cannot be your own wallet address.')
        return
      }
    }
    const endDateTimestamp = Math.floor(new Date(form.endDate).getTime() / 1000)
    if (endDateTimestamp <= Math.floor(Date.now() / 1000)) {
      setError('End date must be in the future.')
      return
    }

    setIsPending(true)
    try {
      let inviteKey = null
      let inviteSigner = zeroAddress
      let partyB = zeroAddress

      if (partyMode === 'invite') {
        inviteKey = generatePrivateKey()
        inviteSigner = privateKeyToAccount(inviteKey).address
      } else {
        partyB = form.partyBAddress.trim()
      }

      const data = encodeFunctionData({
        abi: AGREEMENT_REGISTRY_ABI,
        functionName: 'createAgreement',
        args: [
          agreementType,
          form.title,
          form.description,
          uploadedCID,
          uploadedHash,
          partyB,
          form.partyBName,
          BigInt(endDateTimestamp),
          ZERO_BYTES32,
          inviteSigner,
          signNow,
        ],
      })

      const hash = await sendTx({ to: AGREEMENT_REGISTRY_ADDRESS, data })

      // Find the new agreement ID from the AgreementCreated event
      const receipt = await publicClient.getTransactionReceipt({ hash })
      const events = parseEventLogs({
        abi: AGREEMENT_REGISTRY_ABI,
        eventName: 'AgreementCreated',
        logs: receipt.logs,
      })
      const id = events[0]?.args?.id
      if (!id) throw new Error('Agreement created, but could not read its ID. Check My Agreements.')

      const baseLink = `${window.location.origin}/agreement/${id}`
      const link = inviteKey ? `${baseLink}#invite=${inviteKey}` : baseLink

      if (inviteKey) {
        try { localStorage.setItem(`lexchain-invite-${id}`, inviteKey) } catch { /* storage unavailable */ }
      }

      setCreated({ id, link, isInvite: !!inviteKey, txHash: hash })
    } catch (err) {
      console.error('Create error:', err)
      setError(err.shortMessage || err.message)
    } finally {
      setIsPending(false)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(created.link)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const whatsappLink = created
    ? `https://wa.me/?text=${encodeURIComponent(`Please review and sign "${form.title}" on LexChain: ${created.link}`)}`
    : ''

  // ============ SUCCESS SCREEN ============
  if (created) {
    return (
      <div className="card card-glow" style={{ padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</p>
          <p style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>Agreement Created!</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {signNow ? 'You have already signed it.' : "You haven't signed yet — you can sign anytime from the agreement page."}
          </p>
        </div>

        <label className="label">
          {created.isInvite ? `Invite link for ${form.partyBName}` : 'Agreement link'}
        </label>
        <input className="input" readOnly value={created.link}
          onFocus={e => e.target.select()} style={{ fontFamily: 'monospace', fontSize: '11px', marginBottom: '10px' }} />

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={copyLink}>
            {linkCopied ? '✅ Copied!' : '🔗 Copy link'}
          </button>
          <a className="btn btn-outline" style={{ flex: 1, textDecoration: 'none' }}
            href={whatsappLink} target="_blank" rel="noopener noreferrer">
            💬 Share on WhatsApp
          </a>
        </div>

        {created.isInvite && (
          <div className="tx-status pending" style={{ marginBottom: '16px' }}>
            <span>🔐</span>
            <span style={{ fontSize: '12px' }}>
              This link works like a key — whoever opens it first can sign as Party B. Send it only to {form.partyBName}.
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate(`/agreement/${created.id}`)}>
            Open agreement
          </button>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate('/')}>
            My Agreements
          </button>
        </div>

        <a href={`https://basescan.org/tx/${created.txHash}`} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '11px', color: 'var(--purple-bright)', display: 'block', textAlign: 'center', marginTop: '16px' }}>
          View transaction on Basescan ↗
        </a>
      </div>
    )
  }

  // ============ STEPS ============
  return (
    <div>
      {step === 1 && (
        <div className="card">
          <p className="section-title">What type of agreement?</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
            {AGREEMENT_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => setAgreementType(type.id)}
                style={{
                  padding: '16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                  fontSize: '13px', fontWeight: '500', transition: 'all 0.2s',
                  border: `1px solid ${agreementType === type.id ? 'var(--purple)' : 'var(--border)'}`,
                  background: agreementType === type.id ? 'var(--purple-dim)' : 'transparent',
                  color: agreementType === type.id ? 'var(--purple-bright)' : 'var(--text-muted)',
                }}
              >
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>{type.icon}</div>
                {type.label}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setStep(2)} disabled={!agreementType}>
            Next →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <p className="section-title">Upload Agreement Document</p>

          <div style={{ marginBottom: '16px' }}>
            <label className="label">Agreement Title</label>
            <input className="input" placeholder="e.g. Rental Agreement - 2BHK Koramangala"
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="label">Description (optional)</label>
            <input className="input" placeholder="Brief description of this agreement"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <div className={`upload-area ${uploadSuccess ? 'success' : ''}`}
            onClick={() => document.getElementById('agreementFile').click()} style={{ marginBottom: '16px' }}>
            <input type="file" accept=".pdf,.txt,.doc,.docx" onChange={handleFileUpload}
              style={{ display: 'none' }} id="agreementFile" />
            {uploading ? (
              <p className="pulse" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>⏳ Uploading to IPFS...</p>
            ) : uploadSuccess ? (
              <div>
                <p style={{ fontSize: '14px', color: 'var(--green)', fontWeight: '600' }}>✅ {file?.name}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'monospace' }}>
                  CID: {uploadedCID.slice(0, 24)}...
                </p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '32px' }}>📄</p>
                <p style={{ fontSize: '14px', color: 'var(--text-dim)' }}>Click to upload document</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>PDF, TXT, DOC supported</p>
              </div>
            )}
          </div>

          {uploadSuccess && (
            <>
              <button className="btn btn-outline" style={{ width: '100%', marginBottom: '12px' }}
                onClick={handleSummarize} disabled={summarizing}>
                {summarizing ? <span className="pulse">🤖 AI analyzing...</span> : '🤖 Summarize with AI'}
              </button>
              {aiSummary && (
                <div className="card card-glow" style={{ marginBottom: '12px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: '1.6', marginBottom: '8px' }}>
                    {aiSummary.summary}
                  </p>
                  <span className={`badge ${aiSummary.risk_level === 'High' ? 'badge-red' : aiSummary.risk_level === 'Medium' ? 'badge-amber' : 'badge-green'}`}>
                    Risk: {aiSummary.risk_level}
                  </span>
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline" onClick={() => setStep(1)} style={{ flex: 1 }}>← Back</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep(3)}
              disabled={!uploadSuccess || !form.title}>Next →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <p className="section-title">Who needs to sign?</p>

          {/* Mode switch */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {[
              { id: 'invite', label: '🔗 Send invite link', hint: 'Recommended — no wallet address needed' },
              { id: 'wallet', label: '👛 I know their wallet', hint: 'Registered business or wallet address' },
            ].map(m => (
              <button key={m.id} onClick={() => setPartyMode(m.id)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                  border: `1px solid ${partyMode === m.id ? 'var(--purple)' : 'var(--border)'}`,
                  background: partyMode === m.id ? 'var(--purple-dim)' : 'transparent',
                  color: partyMode === m.id ? 'var(--purple-bright)' : 'var(--text-muted)',
                }}>
                <div style={{ fontSize: '13px', fontWeight: '600' }}>{m.label}</div>
                <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>{m.hint}</div>
              </button>
            ))}
          </div>

          {partyMode === 'invite' ? (
            <div style={{ marginBottom: '16px' }}>
              <label className="label">Their name</label>
              <input className="input" placeholder="e.g. Ram Kumar" value={form.partyBName}
                onChange={e => setForm(f => ({ ...f, partyBName: e.target.value }))} />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                You'll get a link to send them on WhatsApp or email. They sign in with Google and sign — no crypto needed.
              </p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label className="label">Search by business slug</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="input" placeholder="e.g. nexatech2" value={searchSlug}
                    onChange={e => setSearchSlug(e.target.value.toLowerCase())} style={{ flex: 1 }} />
                  <button className="btn btn-outline" onClick={handleSearchBusiness} disabled={searching}>
                    {searching ? '...' : 'Search'}
                  </button>
                </div>
              </div>

              {foundBusiness && (
                <div className="tx-status success" style={{ marginBottom: '16px' }}>
                  <span>✅</span><span>Found: {foundBusiness.name}</span>
                </div>
              )}

              <div style={{ marginBottom: '12px' }}>
                <label className="label">Wallet Address</label>
                <input className="input" placeholder="0x..." value={form.partyBAddress}
                  onChange={e => setForm(f => ({ ...f, partyBAddress: e.target.value }))} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="label">Name</label>
                <input className="input" placeholder="e.g. John Doe" value={form.partyBName}
                  onChange={e => setForm(f => ({ ...f, partyBName: e.target.value }))} />
              </div>
            </>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label className="label">Agreement End Date</label>
            <input className="input" type="date" value={form.endDate}
              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline" onClick={() => setStep(2)} style={{ flex: 1 }}>← Back</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep(4)}
              disabled={
                !form.endDate ||
                (partyMode === 'invite' ? !form.partyBName.trim() : !form.partyBAddress.trim())
              }>
              Next →
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <p className="section-title">Review & Create</p>

          {[
            { label: 'Type', value: AGREEMENT_TYPES.find(t => t.id === agreementType)?.label },
            { label: 'Title', value: form.title },
            { label: 'Document', value: `${uploadedCID.slice(0, 16)}... (IPFS)` },
            { label: 'Counterparty', value: form.partyBName || form.partyBAddress },
            { label: 'How they join', value: partyMode === 'invite' ? 'Invite link' : 'Wallet address' },
            { label: 'Expires', value: form.endDate },
            { label: 'Gas fee', value: 'Free — sponsored by LexChain' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-dim)', maxWidth: '220px', textAlign: 'right' }}>{value}</span>
            </div>
          ))}

          <div className="divider" />

          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer',
            padding: '12px', borderRadius: '10px', marginBottom: '16px',
            border: `1px solid ${signNow ? 'rgba(139,92,246,0.4)' : 'var(--border)'}`,
            background: signNow ? 'var(--purple-dim)' : 'transparent',
          }}>
            <input type="checkbox" checked={signNow} onChange={e => setSignNow(e.target.checked)}
              style={{ marginTop: '3px', accentColor: '#8b5cf6' }} />
            <span>
              <span style={{ fontSize: '13px', fontWeight: '600', display: 'block' }}>Sign now as Party A</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Uncheck to create it as a draft for review — you can sign later from the agreement page.
              </span>
            </span>
          </label>

          {error && (
            <div className="tx-status error" style={{ marginBottom: '12px' }}>
              <span>❌</span>
              <span style={{ fontSize: '12px', wordBreak: 'break-word' }}>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline" onClick={() => setStep(3)} style={{ flex: 1 }} disabled={isPending}>← Back</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleCreate} disabled={isPending || !ready}>
              {!ready
                ? <span className="pulse">⏳ Preparing wallet...</span>
                : isPending
                  ? <span className="pulse">⏳ Creating on blockchain...</span>
                  : signNow ? '⚡ Create & Sign' : '⚡ Create Agreement'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CreateAgreement