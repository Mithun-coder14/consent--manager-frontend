import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { POLICY_REGISTRY_ADDRESS, POLICY_REGISTRY_ABI } from './contracts/config'

function BusinessDashboard() {
  const { address } = useAccount()
  const [formData, setFormData] = useState({
    version: '',
    ipfsCID: '',
    contentHash: ''
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
    }
  }, [isSuccess])

  const handlePublish = async () => {
    if (!formData.version || !formData.ipfsCID || !formData.contentHash) {
      alert('Please fill in all fields')
      return
    }

    const hashBytes = formData.contentHash.padEnd(66, '0').slice(0, 66)

    writeContract({
      address: POLICY_REGISTRY_ADDRESS,
      abi: POLICY_REGISTRY_ABI,
      functionName: 'publishPolicy',
      args: [formData.ipfsCID, hashBytes, formData.version],
    })

    setFormData({ version: '', ipfsCID: '', contentHash: '' })
  }

  return (
    <div>
      {/* Stats */}
      <div className="card" style={{ marginBottom: '20px', textAlign: 'center' }}>
        <p style={{ fontSize: '28px', fontWeight: '700', color: '#7c3aed' }}>
          {policyCount ? policyCount.toString() : '0'}
        </p>
        <p style={{ fontSize: '13px', color: '#6b7280' }}>Policies Published</p>
      </div>

      {/* Publish Form */}
      <div className="card">
        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
          Publish T&C Policy
        </h2>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
            Version
          </label>
          <input
            type="text"
            placeholder="e.g. v1, v2"
            value={formData.version}
            onChange={(e) => setFormData({ ...formData, version: e.target.value })}
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

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
            IPFS CID (document link)
          </label>
          <input
            type="text"
            placeholder="e.g. QmXyz123..."
            value={formData.ipfsCID}
            onChange={(e) => setFormData({ ...formData, ipfsCID: e.target.value })}
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

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
            Content Hash
          </label>
          <input
            type="text"
            placeholder="e.g. 0x1234..."
            value={formData.contentHash}
            onChange={(e) => setFormData({ ...formData, contentHash: e.target.value })}
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

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={handlePublish}
          disabled={isPending}
        >
          {isPending ? 'Publishing...' : 'Publish Policy'}
        </button>

        {isSuccess && (
          <p style={{ color: '#065f46', fontSize: '13px', marginTop: '12px', textAlign: 'center' }}>
            ✅ Policy published successfully on Base!
          </p>
        )}
      </div>
    </div>
  )
}

export default BusinessDashboard