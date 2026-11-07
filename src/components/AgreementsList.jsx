import { useReadContract } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { LEXCHAIN_ADDRESS, LEXCHAIN_ABI } from '../contracts/config'
import { useLexWallet } from '../useLexWallet'
import { STATUS, S, typeIcon, sameAddress, formatDate } from '../lexchain'

const read = (functionName, args, enabled = true) => ({
  address: LEXCHAIN_ADDRESS,
  abi: LEXCHAIN_ABI,
  functionName,
  args,
  query: { enabled },
})

function AgreementCard({ id, me, onOpen }) {
  const { data: a } = useReadContract(read('getAgreement', [id]))
  const { data: parties } = useReadContract(read('getParties', [id]))
  const { data: members } = useReadContract(read('getMembers', [id]))
  const { data: sigs } = useReadContract(read('getSignatures', [id, a ? BigInt(a.currentVersion) : 0n], !!a))
  const pendingIdx = a && a.pendingVersion > 0 ? BigInt(a.pendingVersion - 1) : null
  const { data: pendingSigs } = useReadContract(read('getSignatures', [id, pendingIdx ?? 0n], pendingIdx !== null))
  const { data: acks } = useReadContract(read('getAcknowledgements', [id, a ? BigInt(a.currentVersion) : 0n], !!a))

  if (!a || !parties || !members) {
    return (
      <div className="card" style={{ opacity: 0.5, marginBottom: '12px' }}>
        <p className="pulse" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    )
  }

  const status = Number(a.status)
  const partyIndex = parties.findIndex(p => sameAddress(p.wallet, me))
  const memberIndex = members.findIndex(m => m.active && sameAddress(m.wallet, me))
  const isCreator = partyIndex === 0

  let role = 'Viewer'
  if (partyIndex >= 0) role = isCreator ? 'Creator' : 'Party'
  else if (memberIndex >= 0) {
    const m = members[memberIndex]
    role = `${m.role || 'Team member'} · ${parties[m.partyIndex]?.name || ''}`
  }

  // What, if anything, is waiting on this user?
  let action = null
  if (partyIndex >= 0 && status === S.PENDING && sigs && Number(sigs[partyIndex]) === 0) action = '✍️ Needs your signature'
  if (isCreator && status === S.CHANGES_REQUESTED) action = '✏️ Changes requested'
  if (partyIndex >= 0 && pendingIdx !== null && pendingSigs && Number(pendingSigs[partyIndex]) === 0) action = '📝 Amendment to review'
  if (memberIndex >= 0 && status === S.ACTIVE && acks && Number(acks[memberIndex]) === 0) action = '👀 Acknowledge latest version'

  const signedCount = sigs ? sigs.filter(s => Number(s) > 0).length : 0

  return (
    <div className="card" style={{ cursor: 'pointer', marginBottom: '12px' }} onClick={onOpen}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span style={{ fontSize: '24px' }}>{typeIcon(a.agreementType)}</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: '600', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {parties.length} parties · You: {role}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Expires {formatDate(a.endDate)} · Version {Number(a.currentVersion) + 1}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
          <span className={`badge ${STATUS[status]?.badge}`}>{STATUS[status]?.label}</span>
          {action && <span className="badge badge-purple">{action}</span>}
          {status === S.PENDING && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {signedCount}/{parties.length} signed
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function AgreementsList() {
  const { address, ready } = useLexWallet()
  const navigate = useNavigate()

  const { data: ids, isLoading } = useReadContract(read('getAgreementsByWallet', [address], !!address))

  if (!ready || isLoading) {
    return <div className="empty-state"><p className="pulse" style={{ fontSize: '14px' }}>Loading agreements...</p></div>
  }

  const unique = ids ? [...new Set(ids)].reverse() : []

  if (unique.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">📄</div>
        <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)', marginBottom: '8px' }}>No agreements yet</p>
        <p style={{ marginBottom: '20px' }}>Create your first agreement, or open an invite link someone sent you.</p>
        <button className="btn btn-primary" onClick={() => navigate('/create')}>+ Create Agreement</button>
      </div>
    )
  }

  return (
    <div>
      <p className="section-title" style={{ marginBottom: '16px' }}>
        {unique.length} Agreement{unique.length !== 1 ? 's' : ''}
      </p>
      {unique.map(id => (
        <AgreementCard key={id} id={id} me={address} onOpen={() => navigate(`/agreement/${id}`)} />
      ))}
    </div>
  )
}

export default AgreementsList