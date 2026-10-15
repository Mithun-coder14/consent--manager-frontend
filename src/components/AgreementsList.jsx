import { useReadContract } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { AGREEMENT_REGISTRY_ADDRESS, AGREEMENT_REGISTRY_ABI } from '../contracts/config'
import { useLexWallet } from '../useLexWallet'

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
  lease: '🔑', partnership: '🤝',
}

function AgreementCard({ agreementId, currentAddress, onClick }) {
  const { data: agreement } = useReadContract({
    address: AGREEMENT_REGISTRY_ADDRESS,
    abi: AGREEMENT_REGISTRY_ABI,
    functionName: 'getAgreement',
    args: [agreementId],
  })

  if (!agreement) return (
    <div className="card" style={{ opacity: 0.5, marginBottom: '12px' }}>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }} className="pulse">Loading...</p>
    </div>
  )

  const status = Number(agreement.status)
  const isPartyA = agreement.partyA?.toLowerCase() === currentAddress?.toLowerCase()
  const isPartyB = agreement.partyB?.toLowerCase() === currentAddress?.toLowerCase()
  const needsMySignature = status === 1 && (
    (isPartyA && !agreement.signedByA) || (isPartyB && !agreement.signedByB)
  )
  const endDate = new Date(Number(agreement.endDate) * 1000).toLocaleDateString()

  return (
    <div className="card" style={{ cursor: 'pointer', marginBottom: '12px' }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>{TYPE_ICONS[agreement.agreementType] || '📄'}</span>
          <div>
            <p style={{ fontWeight: '600', fontSize: '14px' }}>{agreement.title}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {isPartyA ? `With: ${agreement.partyBName}` : `From: ${agreement.partyAName}`}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Expires: {endDate}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <span className={`badge ${STATUS_MAP[status]?.class}`}>{STATUS_MAP[status]?.label}</span>
          {needsMySignature && <span className="badge badge-purple">✍️ Needs your signature</span>}
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: agreement.signedByA ? 'var(--green)' : 'var(--amber)' }}>
              {agreement.signedByA ? '✓A' : '○A'}
            </span>
            <span style={{ fontSize: '10px', color: agreement.signedByB ? 'var(--green)' : 'var(--amber)' }}>
              {agreement.signedByB ? '✓B' : '○B'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function AgreementsList() {
  const { address, ready } = useLexWallet()
  const navigate = useNavigate()

  const { data: agreementIds, isLoading } = useReadContract({
    address: AGREEMENT_REGISTRY_ADDRESS,
    abi: AGREEMENT_REGISTRY_ABI,
    functionName: 'getAgreementsByParty',
    args: [address],
    query: { enabled: !!address },
  })

  if (!ready || isLoading) return (
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
      <p style={{ marginBottom: '20px' }}>
        Create your first agreement, or open a link someone shared with you.
      </p>
      <button className="btn btn-primary" onClick={() => navigate('/create')}>+ Create Agreement</button>
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
          onClick={() => navigate(`/agreement/${id}`)}
        />
      ))}
    </div>
  )
}

export default AgreementsList