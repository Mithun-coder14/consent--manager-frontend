import { useState } from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { injected } from 'wagmi/connectors'
import BusinessDashboard from './BusinessDashboard'
import UserDashboard from './UserDashboard'
import './index.css'

function App() {
  const [activeTab, setActiveTab] = useState('user')
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : ''

  const handleConnect = async () => {
    connect({ connector: injected() })
    setTimeout(() => {
      switchChain({ chainId: 8453 })
    }, 1000)
  }

  return (
    <div>
      {/* Header */}
      <div className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Consent Manager</h1>
            <p>Transparent. On-chain. Yours.</p>
          </div>
          {isConnected ? (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '13px', color: '#7c3aed', fontWeight: '500' }}>
                {shortAddress}
              </p>
              <button
                className="btn btn-primary"
                style={{ marginTop: '6px', padding: '6px 12px', fontSize: '12px', marginRight: '6px' }}
                onClick={() => switchChain({ chainId: 8453 })}
              >
                Switch to Base
              </button>
              <button
                className="btn btn-outline"
                style={{ marginTop: '6px', padding: '6px 12px', fontSize: '12px' }}
                onClick={() => disconnect()}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleConnect}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'user' ? 'active' : ''}`}
          onClick={() => setActiveTab('user')}
        >
          My Consents
        </button>
        <button
          className={`tab ${activeTab === 'business' ? 'active' : ''}`}
          onClick={() => setActiveTab('business')}
        >
          Business
        </button>
      </div>

      {/* Content */}
      <div className="content">
        {!isConnected ? (
          <div className="empty-state">
            <div className="icon">🔐</div>
            <p>Connect your wallet to get started</p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '16px' }}
              onClick={handleConnect}
            >
              Connect Wallet
            </button>
          </div>
        ) : activeTab === 'user' ? (
          <UserDashboard />
        ) : (
          <BusinessDashboard />
        )}
      </div>
    </div>
  )
}

export default App