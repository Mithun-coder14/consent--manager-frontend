import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { useAccount } from 'wagmi'
import { AGREEMENT_REGISTRY_ADDRESS, AGREEMENT_REGISTRY_ABI } from '../contracts/config'
import { uploadToPinata, generateContentHash } from '../pinata'
import { summarizeTandC } from '../groq'

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

function CreateAgreement({ onCreated }) {
  const { address } = useAccount()
  const [step, setStep] = useState(1)
  const [agreementType, setAgreementType] = useState('')
  const [form, setForm] = useState({
    title: '',
    description: '',
    partyBAddress: '',
    partyBName: '',
    endDate: '',
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

  const { writeContract, isPending, data: txHash } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  // Search business by slug
  const { data: businessData, refetch: searchBusiness } = useReadContract({
    address: AGREEMENT_REGISTRY_ADDRESS,
    abi: AGREEMENT_REGISTRY_ABI,
    functionName: 'getBusinessBySlug',
    args: [searchSlug],
    query: { enabled: false }
  })

  const handleSearchBusiness = async () => {
    if (!searchSlug) return
    setSearching(true)
    try {
      const result = await searchBusiness()
      if (result.data) {
        setFoundBusiness(result.data)
        setForm(f => ({
          ...f,
          partyBAddress: result.data.wallet,
          partyBName: result.data.name
        }))
      }
    } catch (e) {
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
      const hash = await generateContentHash(selectedFile)
      setUploadedHash(hash)
      const result = await uploadToPinata(selectedFile)
      setUploadedCID(result.cid)
      const text = await selectedFile.text()
      setFileText(text)
      setUploadSuccess(true)
    } catch (error) {
      alert('Upload failed: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSummarize = async () => {
    if (!fileText) return
    setSummarizing(true)
    try {
      const summary = await summarizeTandC(fileText)
      setAiSummary(summary)
    } catch (error) {
      alert('AI summarization failed: ' + error.message)
    } finally {
      setSummarizing(false)
    }
  }

  const handleCreate = () => {
    if (!form.title || !uploadedCID || !form.partyBAddress || !form.endDate) {
      alert('Please complete all fields')
      return
    }

    const endDateTimestamp = Math.floor(new Date(form.endDate).getTime() / 1000)

    writeContract({
      address: AGREEMENT_REGISTRY_ADDRESS,
      abi: AGREEMENT_REGISTRY_ABI,
      functionName: 'createAgreement',
      args: [
        agreementType,
        form.title,
        form.description,
        uploadedCID,
        uploadedHash,
        form.partyBAddress,
        form.partyBName,
        BigInt(endDateTimestamp),
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      ],
    })
  }

  if (isSuccess) {
    return (
      <div className="card card-glow" style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</p>
        <p style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
          Agreement Created!
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Sent to {form.partyBName || form.partyBAddress} for signing.
        </p>
        <button className="btn btn-primary" onClick={() => {
          setStep(1)
          setAgreementType('')
          setForm({ title: '', description: '', partyBAddress: '', partyBName: '', endDate: '' })
          setFile(null)
          setUploadedCID('')
          setUploadedHash('')
          setUploadSuccess(false)
          setAiSummary(null)
          if (onCreated) onCreated()
        }}>
          Create Another
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Step 1 — Choose type */}
      {step === 1 && (
        <div className="card">
          <p className="section-title">What type of agreement?</p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '10px',
            marginBottom: '16px'
          }}>
            {AGREEMENT_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => setAgreementType(type.id)}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: `1px solid ${agreementType === type.id ? 'var(--purple)' : 'var(--border)'}`,
                  background: agreementType === type.id ? 'var(--purple-dim)' : 'transparent',
                  color: agreementType === type.id ? 'var(--purple-bright)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: '500'
                }}
              >
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>{type.icon}</div>
                {type.label}
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => setStep(2)}
            disabled={!agreementType}
          >
            Next →
          </button>
        </div>
      )}

      {/* Step 2 — Upload document */}
      {step === 2 && (
        <div className="card">
          <p className="section-title">Upload Agreement Document</p>

          <div style={{ marginBottom: '16px' }}>
            <label className="label">Agreement Title</label>
            <input
              className="input"
              placeholder="e.g. Rental Agreement - 2BHK Koramangala"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="label">Description (optional)</label>
            <input
              className="input"
              placeholder="Brief description of this agreement"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div
            className={`upload-area ${uploadSuccess ? 'success' : ''}`}
            onClick={() => document.getElementById('agreementFile').click()}
            style={{ marginBottom: '16px' }}
          >
            <input
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="agreementFile"
            />
            {uploading ? (
              <div>
                <p style={{ fontSize: '24px' }} className="pulse">⏳</p>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Uploading to IPFS...</p>
              </div>
            ) : uploadSuccess ? (
              <div>
                <p style={{ fontSize: '24px' }}>✅</p>
                <p style={{ fontSize: '14px', color: 'var(--green)', fontWeight: '600' }}>{file?.name}</p>
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
              <button
                className="btn btn-outline"
                style={{ width: '100%', marginBottom: '12px' }}
                onClick={handleSummarize}
                disabled={summarizing}
              >
                {summarizing ? <span className="pulse">🤖 AI analyzing...</span> : '🤖 Summarize with AI'}
              </button>

              {aiSummary && (
                <div className="card card-glow" style={{ marginBottom: '12px' }}>
                  <p className="section-title">AI Summary</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: '1.6', marginBottom: '12px' }}>
                    {aiSummary.summary}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span className={`badge ${aiSummary.risk_level === 'High' ? 'badge-red' : aiSummary.risk_level === 'Medium' ? 'badge-amber' : 'badge-green'}`}>
                      Risk: {aiSummary.risk_level}
                    </span>
                    <span className="badge badge-blue">{aiSummary.data_collected?.length || 0} data types</span>
                    <span className="badge badge-purple">{aiSummary.vendors?.length || 0} vendors</span>
                  </div>
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline" onClick={() => setStep(1)} style={{ flex: 1 }}>← Back</button>
            <button
              className="btn btn-primary"
              style={{ flex: 2 }}
              onClick={() => setStep(3)}
              disabled={!uploadSuccess || !form.title}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Counterparty */}
      {step === 3 && (
        <div className="card">
          <p className="section-title">Who needs to sign?</p>

          {/* Search by business name */}
          <div style={{ marginBottom: '16px' }}>
            <label className="label">Search by business name</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="input"
                placeholder="e.g. nexatech"
                value={searchSlug}
                onChange={e => setSearchSlug(e.target.value.toLowerCase())}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-outline"
                onClick={handleSearchBusiness}
                disabled={searching}
              >
                {searching ? '...' : 'Search'}
              </button>
            </div>
          </div>

          {foundBusiness && (
            <div style={{
              padding: '12px',
              borderRadius: '10px',
              background: 'var(--green-dim)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              marginBottom: '16px'
            }}>
              <p style={{ fontSize: '13px', color: 'var(--green)', fontWeight: '600' }}>
                ✅ Found: {foundBusiness.name}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '4px' }}>
                {foundBusiness.wallet}
              </p>
            </div>
          )}

          <div className="divider" />

          {/* Or enter manually */}
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Or enter wallet address manually
          </p>

          <div style={{ marginBottom: '12px' }}>
            <label className="label">Counterparty Wallet Address</label>
            <input
              className="input"
              placeholder="0x..."
              value={form.partyBAddress}
              onChange={e => setForm(f => ({ ...f, partyBAddress: e.target.value }))}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="label">Counterparty Name</label>
            <input
              className="input"
              placeholder="e.g. John Doe"
              value={form.partyBName}
              onChange={e => setForm(f => ({ ...f, partyBName: e.target.value }))}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="label">Agreement End Date</label>
            <input
              className="input"
              type="date"
              value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline" onClick={() => setStep(2)} style={{ flex: 1 }}>← Back</button>
            <button
              className="btn btn-primary"
              style={{ flex: 2 }}
              onClick={() => setStep(4)}
              disabled={!form.partyBAddress || !form.endDate}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Review & Create */}
      {step === 4 && (
        <div className="card">
          <p className="section-title">Review & Create</p>

          <div style={{ marginBottom: '16px' }}>
            {[
              { label: 'Type', value: AGREEMENT_TYPES.find(t => t.id === agreementType)?.label },
              { label: 'Title', value: form.title },
              { label: 'Document', value: `${uploadedCID.slice(0, 16)}... (IPFS)` },
              { label: 'Counterparty', value: form.partyBName || form.partyBAddress },
              { label: 'Expires', value: form.endDate },
            ].map(({ label, value }) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between',
                marginBottom: '12px', alignItems: 'center'
              }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-dim)', maxWidth: '200px', textAlign: 'right' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className="divider" />

          <div style={{
            padding: '12px', borderRadius: '10px',
            background: 'var(--amber-dim)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            marginBottom: '16px'
          }}>
            <p style={{ fontSize: '12px', color: 'var(--amber)' }}>
              ⚡ This creates the agreement on Base blockchain. Small gas fee applies.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline" onClick={() => setStep(3)} style={{ flex: 1 }}>← Back</button>
            <button
              className="btn btn-primary"
              style={{ flex: 2 }}
              onClick={handleCreate}
              disabled={isPending}
            >
              {isPending ? <span className="pulse">⏳ Creating on blockchain...</span> : '⚡ Create Agreement'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CreateAgreement