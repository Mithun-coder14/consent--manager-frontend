import { useState } from 'react'
import { useReadContract } from 'wagmi'
import { encodeFunctionData } from 'viem'
import { AGREEMENT_REGISTRY_ADDRESS, AGREEMENT_REGISTRY_ABI } from '../contracts/config'
import { uploadToPinata, generateContentHash } from '../pinata'
import { summarizeTandC } from '../groq'
import { useLexWallet } from '../useLexWallet'

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

function CreateAgreement({ onCreated }) {
  const { address, sendTx, ready } = useLexWallet()
  const [step, setStep] = useState(1)
  const [agreementType, setAgreementType] = useState('')
  const [form, setForm] = useState({
    title: '', description: '', partyBAddress: '', partyBName: '', endDate: '',
  })
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
  const [isSuccess, setIsSuccess] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [error, setError] = useState(null)

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
      setFileText(await selectedFile.text())
      setUploadSuccess(true)
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSummarize = async () => {
    if (!fileText) return
    setSummarizing(true)
    try {
      setAiSummary(await summarizeTandC(fileText))
    } catch (err) {
      alert('AI summarization failed: ' + err.message)
    } finally {
      setSummarizing(false)
    }
  }

  const handleCreate = async () => {
    setError(null)

    if (!form.title || !uploadedCID || !form.partyBAddress || !form.endDate) {
      setError('Please complete all fields')
      return
    }
    if (address && address.toLowerCase() === form.partyBAddress.trim().toLowerCase()) {
      setError('Party B cannot be your own wallet address.')
      return
    }
    const endDateTimestamp = Math.floor(new Date(form.endDate).getTime() / 1000)
    if (endDateTimestamp <= Math.floor(Date.now() / 1000)) {
      setError('End date must be in the future.')
      return
    }

    setIsPending(true)
    try {
      const data = encodeFunctionData({
        abi: AGREEMENT_REGISTRY_ABI,
        functionName: 'createAgreement',
        args: [
          agreementType,
          form.title,
          form.description,
          uploadedCID,
          uploadedHash,
          form.partyBAddress.trim(),
          form.partyBName,
          BigInt(endDateTimestamp),
          ZERO_BYTES32,
        ],
      })
      const hash = await sendTx({ to: AGREEMENT_REGISTRY_ADDRESS, data })
      setTxHash(hash)
      setIsSuccess(true)
    } catch (err) {
      console.error('Create error:', err)
      setError(err.shortMessage || err.message)
    } finally {
      setIsPending(false)
    }
  }

  const resetForm = () => {
    setStep(1)
    setAgreementType('')
    setForm({ title: '', description: '', partyBAddress: '', partyBName: '', endDate: '' })
    setFile(null)
    setFileText('')
    setUploadedCID('')
    setUploadedHash('')
    setUploadSuccess(false)
    setAiSummary(null)
    setSearchSlug('')
    setFoundBusiness(null)
    setIsSuccess(false)
    setTxHash('')
    setError(null)
  }

  if (isSuccess) {
    return (
      <div className="card card-glow" style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</p>
        <p style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Agreement Created!</p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Sent to {form.partyBName || form.partyBAddress} for signing. Next: open it and sign as Party A.
        </p>
        <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '12px', color: 'var(--purple-bright)', display: 'block', marginBottom: '24px' }}>
          View transaction on Basescan ↗
        </a>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={resetForm}>Create Another</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onCreated && onCreated()}>
            Go to My Agreements
          </button>
        </div>
      </div>
    )
  }

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
              <span>✅</span>
              <span>Found: {foundBusiness.name}</span>
            </div>
          )}

          <div className="divider" />

          <div style={{ marginBottom: '12px' }}>
            <label className="label">Counterparty Wallet Address</label>
            <input className="input" placeholder="0x..." value={form.partyBAddress}
              onChange={e => setForm(f => ({ ...f, partyBAddress: e.target.value }))} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="label">Counterparty Name</label>
            <input className="input" placeholder="e.g. John Doe" value={form.partyBName}
              onChange={e => setForm(f => ({ ...f, partyBName: e.target.value }))} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="label">Agreement End Date</label>
            <input className="input" type="date" value={form.endDate}
              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline" onClick={() => setStep(2)} style={{ flex: 1 }}>← Back</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep(4)}
              disabled={!form.partyBAddress || !form.endDate}>Next →</button>
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
            { label: 'Expires', value: form.endDate },
            { label: 'Gas fee', value: 'Free — sponsored by LexChain' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-dim)', maxWidth: '220px', textAlign: 'right' }}>{value}</span>
            </div>
          ))}

          <div className="divider" />

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
                  : '⚡ Create Agreement'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CreateAgreement