import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { POLICY_REGISTRY_ADDRESS, POLICY_REGISTRY_ABI } from './contracts/config'
import { uploadToPinata, generateContentHash } from './pinata'
import { summarizeTandC } from './groq'

const DATA_TYPES = [
  'Email address', 'Phone number', 'Full name', 'Date of birth',
  'Location data', 'IP address', 'Browsing history', 'Purchase history',
  'Device information', 'Cookies', 'Biometric data', 'Financial data'
]

const PURPOSES = [
  'Analytics', 'Marketing', 'Product improvement', 'Legal compliance',
  'Customer support', 'Personalization', 'Security', 'Research'
]

const DURATION_OPTIONS = [
  '30 days', '90 days', '6 months', '1 year', '2 years', '5 years', 'Indefinitely'
]

function BusinessDashboard() {
  const { address } = useAccount()
  const [step, setStep] = useState(1) // 1: Upload, 2: Disclosure, 3: Review
  const [version, setVersion] = useState('')
  const [file, setFile] = useState(null)
  const [fileText, setFileText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadedCID, setUploadedCID] = useState('')
  const [uploadedHash, setUploadedHash] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [aiSummary, setAiSummary] = useState(null)
  const [disclosure, setDisclosure] = useState({
    dataTypes: [],
    purposes: [],
    duration: '',
    vendors: '',
  })

  const { writeContract, isPending, data: txHash } = useWriteContract()
  const { data: policyCount, refetch } = useReadContract({
    address: POLICY_REGISTRY_ADDRESS,
    abi: POLICY_REGISTRY_ABI,
    functionName: 'getPolicyCount',
    args: [address],
  })

  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    if (isSuccess) {
      refetch()
      setStep(1)
      setVersion('')
      setFile(null)
      setFileText('')
      setUploadedCID('')
      setUploadedHash('')
      setUploadSuccess(false)
      setAiSummary(null)
      setDisclosure({ dataTypes: [], purposes: [], duration: '', vendors: '' })
    }
  }, [isSuccess])

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

      // Read file text for AI
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
      // Auto-fill disclosure form from AI analysis
      if (summary.data_collected) setDisclosure(d => ({ ...d, dataTypes: summary.data_collected }))
      if (summary.purpose) setDisclosure(d => ({ ...d, purposes: summary.purpose }))
      if (summary.duration) setDisclosure(d => ({ ...d, duration: summary.duration }))
      if (summary.vendors) setDisclosure(d => ({ ...d, vendors: summary.vendors.join(', ') }))
    } catch (error) {
      alert('AI summarization failed: ' + error.message)
    } finally {
      setSummarizing(false)
    }
  }

  const toggleDataType = (type) => {
    setDisclosure(d => ({
      ...d,
      dataTypes: d.dataTypes.includes(type)
        ? d.dataTypes.filter(t => t !== type)
        : [...d.dataTypes, type]
    }))
  }

  const togglePurpose = (purpose) => {
    setDisclosure(d => ({
      ...d,
      purposes: d.purposes.includes(purpose)
        ? d.purposes.filter(p => p !== purpose)
        : [...d.purposes, purpose]
    }))
  }

  const handlePublish = () => {
    if (!version || !uploadedCID || !uploadedHash) {
      alert('Please complete all steps first')
      return
    }
    writeContract({
      address: POLICY_REGISTRY_ADDRESS,
      abi: POLICY_REGISTRY_ABI,
      functionName: 'publishPolicy',
      args: [uploadedCID, uploadedHash, version],
    })
  }

  const riskColor = {
    'Low': 'badge-green',
    'Medium': 'badge-amber',
    'High': 'badge-red'
  }

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{policyCount ? policyCount.toString() : '0'}</div>
          <div className="stat-label">Published</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: '14px', paddingTop: '6px' }}>
            <span style={{ color: 'var(--green)', fontSize: '10px' }}>●</span> Base
          </div>
          <div className="stat-label">Network</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: '14px', paddingTop: '6px' }}>IPFS</div>
          <div className="stat-label">Storage</div>
        </div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center' }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: step >= s ? 'var(--purple)' : 'var(--bg-card)',
              border: `1px solid ${step >= s ? 'var(--purple)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: '700', color: step >= s ? 'white' : 'var(--text-muted)'
            }}>
              {s}
            </div>
            <span style={{ fontSize: '12px', color: step >= s ? 'var(--text)' : 'var(--text-muted)' }}>
              {s === 1 ? 'Upload' : s === 2 ? 'Disclosure' : 'Publish'}
            </span>
            {s < 3 && <div style={{ width: '24px', height: '1px', background: 'var(--border)' }} />}
          </div>
        ))}
      </div>

      {/* Step 1 — Upload */}
      {step === 1 && (
        <div className="card">
          <p className="section-title">Step 1 — Upload T&C Document</p>

          <div style={{ marginBottom: '16px' }}>
            <label className="label">Policy Version</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. v1, v2, 2026-Q1"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </div>

          <div
            className={`upload-area ${uploadSuccess ? 'success' : ''}`}
            onClick={() => document.getElementById('fileInput').click()}
          >
            <input
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="fileInput"
            />
            {uploading ? (
              <div>
                <p style={{ fontSize: '24px', marginBottom: '8px' }} className="pulse">⏳</p>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Uploading to IPFS...</p>
              </div>
            ) : uploadSuccess ? (
              <div>
                <p style={{ fontSize: '24px', marginBottom: '8px' }}>✅</p>
                <p style={{ fontSize: '14px', color: 'var(--green)', fontWeight: '600' }}>
                  {file?.name}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'monospace' }}>
                  CID: {uploadedCID.slice(0, 24)}...
                </p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '32px', marginBottom: '8px' }}>📄</p>
                <p style={{ fontSize: '14px', color: 'var(--text-dim)' }}>Click to upload T&C document</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  PDF, TXT, DOC supported
                </p>
              </div>
            )}
          </div>

          {uploadSuccess && (
            <div style={{ marginTop: '16px' }}>
              <button
                className="btn btn-outline"
                style={{ width: '100%', marginBottom: '12px' }}
                onClick={handleSummarize}
                disabled={summarizing}
              >
                {summarizing ? (
                  <span className="pulse">🤖 AI is analyzing your document...</span>
                ) : (
                  '🤖 Summarize with AI'
                )}
              </button>

              {aiSummary && (
                <div className="card card-glow" style={{ marginTop: '12px' }}>
                  <p className="section-title">AI Analysis</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: '1.6', marginBottom: '12px' }}>
                    {aiSummary.summary}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <span className={`badge ${riskColor[aiSummary.risk_level] || 'badge-purple'}`}>
                      Risk: {aiSummary.risk_level}
                    </span>
                    <span className="badge badge-blue">
                      {aiSummary.data_collected?.length || 0} data types
                    </span>
                    <span className="badge badge-purple">
                      {aiSummary.vendors?.length || 0} vendors
                    </span>
                  </div>
                  {aiSummary.key_concerns?.length > 0 && (
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        KEY CONCERNS
                      </p>
                      {aiSummary.key_concerns.map((concern, i) => (
                        <p key={i} style={{ fontSize: '12px', color: 'var(--amber)', marginBottom: '4px' }}>
                          ⚠️ {concern}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '12px' }}
                onClick={() => setStep(2)}
                disabled={!version}
              >
                Next → Data Disclosure
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2 — Disclosure */}
      {step === 2 && (
        <div className="card">
          <p className="section-title">Step 2 — Data Disclosure</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Be transparent with your users about exactly what data you collect and why.
          </p>

          {/* Data types */}
          <div style={{ marginBottom: '20px' }}>
            <label className="label">What data do you collect?</label>
            <div className="tag-list">
              {DATA_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => toggleDataType(type)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    border: `1px solid ${disclosure.dataTypes.includes(type) ? 'var(--purple)' : 'var(--border)'}`,
                    background: disclosure.dataTypes.includes(type) ? 'var(--purple-dim)' : 'transparent',
                    color: disclosure.dataTypes.includes(type) ? 'var(--purple-bright)' : 'var(--text-muted)',
                    transition: 'all 0.2s'
                  }}
                >
                  {disclosure.dataTypes.includes(type) ? '✓ ' : ''}{type}
                </button>
              ))}
            </div>
          </div>

          {/* Purposes */}
          <div style={{ marginBottom: '20px' }}>
            <label className="label">Purpose of data collection</label>
            <div className="tag-list">
              {PURPOSES.map(purpose => (
                <button
                  key={purpose}
                  onClick={() => togglePurpose(purpose)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    border: `1px solid ${disclosure.purposes.includes(purpose) ? 'var(--green)' : 'var(--border)'}`,
                    background: disclosure.purposes.includes(purpose) ? 'var(--green-dim)' : 'transparent',
                    color: disclosure.purposes.includes(purpose) ? 'var(--green)' : 'var(--text-muted)',
                    transition: 'all 0.2s'
                  }}
                >
                  {disclosure.purposes.includes(purpose) ? '✓ ' : ''}{purpose}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div style={{ marginBottom: '20px' }}>
            <label className="label">How long do you keep the data?</label>
            <div className="tag-list">
              {DURATION_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDisclosure(prev => ({ ...prev, duration: d }))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    border: `1px solid ${disclosure.duration === d ? 'var(--amber)' : 'var(--border)'}`,
                    background: disclosure.duration === d ? 'var(--amber-dim)' : 'transparent',
                    color: disclosure.duration === d ? 'var(--amber)' : 'var(--text-muted)',
                    transition: 'all 0.2s'
                  }}
                >
                  {disclosure.duration === d ? '✓ ' : ''}{d}
                </button>
              ))}
            </div>
          </div>

          {/* Vendors */}
          <div style={{ marginBottom: '20px' }}>
            <label className="label">Third-party vendors (comma separated)</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. Google Analytics, Stripe, AWS, Intercom"
              value={disclosure.vendors}
              onChange={(e) => setDisclosure(d => ({ ...d, vendors: e.target.value }))}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline" onClick={() => setStep(1)} style={{ flex: 1 }}>
              ← Back
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 2 }}
              onClick={() => setStep(3)}
            >
              Next → Review & Publish
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Review & Publish */}
      {step === 3 && (
        <div className="card">
          <p className="section-title">Step 3 — Review & Publish</p>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Version</span>
              <span className="badge badge-purple">{version}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Document</span>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                {uploadedCID.slice(0, 16)}...
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Data collected</span>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                {disclosure.dataTypes.length} types
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Duration</span>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                {disclosure.duration || 'Not specified'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Vendors</span>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                {disclosure.vendors || 'None specified'}
              </span>
            </div>
          </div>

          <div className="divider" />

          <div style={{
            padding: '12px',
            borderRadius: '10px',
            background: 'var(--amber-dim)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            marginBottom: '16px'
          }}>
            <p style={{ fontSize: '12px', color: 'var(--amber)' }}>
              ⚡ This will publish your policy permanently on Base blockchain. Gas fee applies.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline" onClick={() => setStep(2)} style={{ flex: 1 }}>
              ← Back
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 2 }}
              onClick={handlePublish}
              disabled={isPending}
            >
              {isPending ? (
                <span className="pulse">⏳ Publishing on Base...</span>
              ) : (
                '⚡ Publish on Blockchain'
              )}
            </button>
          </div>

          {isSuccess && (
            <div className="tx-status success">
              <span>✅</span>
              <span>Policy published successfully on Base!</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default BusinessDashboard