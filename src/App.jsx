import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useAccount, useSwitchChain } from 'wagmi'
import RegisterBusiness from './components/RegisterBusiness'
import CreateAgreement from './components/CreateAgreement'
import AgreementsList from './components/AgreementsList'
import './index.css'

function App() {
  const [activeTab, setActiveTab] = useState('agreements')
  const { login, logout, authenticated, user } = usePrivy()
  const { address } = useAccount()
  const { switchChain } = useSwitchChain()

  const displayName = user?.email?.address || user?.google?.email || 
    (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '')

  return (
    <div>
      {/* Header */}
      <div className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>⚡ LexChain</h1>
            <p>Agreements on Blockchain — If anyone changes, everyone knows.</p>
          </div>
          {authenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="glow-dot"></span>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                  {displayName}
                </span>
              </div>
              <button
                className="btn btn-outline"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => switchChain({ chainId: 8453 })}
              >
                Base
              </button>
              <button
                className="btn btn-danger"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={logout}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={login}>
              Get Started
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {authenticated && (
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'agreements' ? 'active' : ''}`}
            onClick={() => setActiveTab('agreements')}
          >
            My Agreements
          </button>
          <button
            className={`tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            + Create
          </button>
          <button
            className={`tab ${activeTab === 'business' ? 'active' : ''}`}
            onClick={() => setActiveTab('business')}
          >
            Business Profile
          </button>
        </div>
      )}

      {/* Content */}
      <div className="content">
        {!authenticated ? (
          <div className="empty-state">
            <div className="icon">⚡</div>
            <p style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)', marginBottom: '8px' }}>
              Welcome to LexChain
            </p>
            <p style={{ marginBottom: '8px', color: 'var(--text-dim)' }}>
              Agreements on Blockchain — If anyone changes, everyone knows.
            </p>
            <p style={{ marginBottom: '24px', fontSize: '13px', color: 'var(--text-muted)' }}>
              Rental agreements · Employment contracts · NDAs · T&Cs · Insurance policies
            </p>
            <button
              className="btn btn-primary"
              style={{ padding: '12px 32px', fontSize: '15px' }}
              onClick={login}
            >
              Get Started — it's free
            </button>
            <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Sign in with Google, email or wallet · Running on Base
            </p>
          </div>
        ) : activeTab === 'agreements' ? (
          <AgreementsList />
        ) : activeTab === 'create' ? (
          <CreateAgreement onCreated={() => setActiveTab('agreements')} />
        ) : (
          <RegisterBusiness />
        )}
      </div>
    </div>
  )
}

export default App