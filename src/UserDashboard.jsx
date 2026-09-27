import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONSENT_LEDGER_ADDRESS, CONSENT_LEDGER_ABI, POLICY_REGISTRY_ADDRESS, POLICY_REGISTRY_ABI } from './contracts/config'

function UserDashboard() {
  const { address } = useAccount()
  const [businessAddress, setBusinessAddress] = useState('')
  const [checking, setChecking] = useState(false)
  const [consentStatus, setConsentStatus] = useState(null)
  const [outdatedStatus, setOutdatedStatus] = useState(null)

  const { writeContract, isPending, data: txHash } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  // Check active consent
  const { data: hasConsent, refetch: refetchConsent } = useReadContract({
    address: CONSENT_LEDGER_ADDRESS,
    abi: CONSENT_LEDGER_ABI,
    functionName: 'hasActiveConsent',
    args: [address, businessAddress],
    query: { enabled: !!businessAddress && !!address }
  })

  // Check if outdated
  const { data: isOutdated, refetch: refetchOutdated } = useReadContract({
    address: CONSENT_LEDGER_ADDRESS,
    abi: CONSENT_LEDGER_ABI,
    functionName: 'isConsentOutdated',
    args: [address, businessAddress],
    query: { enabled: !!businessAddress && !!address }
  })

  // Get consent details
  const { data: consentDetails, refetch: refetchDetails } = useReadContract({
    address: CONSENT_LEDGER_ADDRESS,
    abi: CONSENT_LEDGER_ABI,
    functionName: 'getConsentDetails',
    args: [address, businessAddress],
    query: { enabled: !!businessAddress && !!address }
  })

  useEffect(() => {
    if (isSuccess) {
      refetchConsent()
      refetchOutdated()
      refetchDetails()
    }
  }, [isSuccess])

  const handleGrantConsent = () => {
    if (!businessAddress) {
      alert('Please enter a business address')
      return
    }
    writeContract({
      address: CONSENT_LEDGER_ADDRESS,
      abi: CONSENT_LEDGER_ABI,
      functionName: 'grantConsent',
      args: [businessAddress],
    })
  }

  const handleRevokeConsent = () => {
    writeContract({
      address: CONSENT_LEDGER_ADDRESS,
      abi: CONSENT_LEDGER_ABI,
      functionName: 'revokeConsent',
      args: [businessAddress],
    })
  }

  return (
    <div>
      {/* Check Consent Section */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
          Check / Manage Consent
        </h2>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
            Business Wallet Address
          </label>
          <input
            type="text"
            placeholder="0x..."
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>

        {/* Consent Status */}
        {businessAddress && hasConsent !== undefined && (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '12px',
            background: hasConsent ? '#d1fae5' : '#fee2e2',
            border: `1px solid ${hasConsent ? '#6ee7b7' : '#fca5a5'}`
          }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: hasConsent ? '#065f46' : '#991b1b' }}>
              {hasConsent ? '✅ Active Consent' : '❌ No Active Consent'}
            </p>
            {consentDetails && hasConsent && (
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Consented to version: {consentDetails[0]}
              </p>
            )}
            {isOutdated && (
              <p style={{ fontSize: '12px', color: '#92400e', marginTop: '4px' }}>
                ⚠️ T&C has been updated — please re-consent
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleGrantConsent}
            disabled={isPending}
          >
            {isPending ? 'Processing...' : hasConsent ? 'Re-consent' : 'Grant Consent'}
          </button>
          {hasConsent && (
            <button
              className="btn btn-outline"
              style={{ flex: 1 }}
              onClick={handleRevokeConsent}
              disabled={isPending}
            >
              Revoke
            </button>
          )}
        </div>

        {isSuccess && (
          <p style={{ color: '#065f46', fontSize: '13px', marginTop: '12px', textAlign: 'center' }}>
            ✅ Transaction confirmed on Base!
          </p>
        )}
      </div>

      {/* Info card */}
      <div className="card" style={{ background: '#f9fafb' }}>
        <p style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center' }}>
          Enter a business wallet address above to check your consent status, grant consent, or revoke it. All actions are recorded on Base blockchain.
        </p>
      </div>
    </div>
  )
}

export default UserDashboard