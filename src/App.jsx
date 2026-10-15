import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import RegisterBusiness from './components/RegisterBusiness'
import CreateAgreement from './components/CreateAgreement'
import AgreementsList from './components/AgreementsList'
import AgreementView from './components/AgreementView'
import { useLexWallet } from './useLexWallet'
import './index.css'

function Header() {
  const { login, logout, authenticated, user } = usePrivy()
  const { address } = useLexWallet()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const displayName = user?.email?.address || user?.google?.email || ''

  const copyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="header">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <h1>⚡ LexChain</h1>
          <p>Agreements on Blockchain — If anyone changes, everyone knows.</p>
        </div>
        {authenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                <span className="glow-dot"></span>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{displayName}</span>
              </div>
              {address && (
                <span
                  onClick={copyAddress}
                  title="Click to copy"
                  style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', cursor: 'pointer' }}
                >
                  {copied ? 'Copied!' : `${address.slice(0, 8)}...${address.slice(-6)}`}
                </span>
              )}
            </div>
            <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={logout}>
              Sign out
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={login}>Get Started</button>
        )}
      </div>
    </div>
  )
}

function Welcome() {
  const { login } = usePrivy()
  return (
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
      <button className="btn btn-primary" style={{ padding: '12px 32px', fontSize: '15px' }} onClick={login}>
        Get Started — it's free
      </button>
      <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
        Sign in with Google, email or wallet · No crypto needed · Running on Base
      </p>
    </div>
  )
}

function SignInForAgreement() {
  const { login } = usePrivy()
  return (
    <div className="card" style={{ maxWidth: '420px', margin: '40px auto', textAlign: 'center' }}>
      <p style={{ fontSize: '32px', marginBottom: '16px' }}>📄</p>
      <p style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>You've been sent an agreement</p>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
        Sign in to review and sign it. No crypto or fees needed.
      </p>
      <button className="btn btn-primary" style={{ width: '100%' }} onClick={login}>
        Sign in to Continue
      </button>
    </div>
  )
}

function App() {
  const { authenticated, ready } = usePrivy()
  const navigate = useNavigate()
  const location = useLocation()

  const isAgreementPage = location.pathname.startsWith('/agreement/')

  const activeTab =
    location.pathname.startsWith('/create') ? 'create'
    : location.pathname.startsWith('/business') ? 'business'
    : location.pathname === '/' ? 'agreements'
    : ''

  if (!ready) {
    return (
      <div className="empty-state" style={{ paddingTop: '120px' }}>
        <p className="pulse">Loading LexChain...</p>
      </div>
    )
  }

  return (
    <div>
      <Header />
      <p style={{ color: 'red', padding: '8px 24px', fontFamily: 'monospace' }}>
        
      </p>

      {authenticated && !isAgreementPage && (
        <div className="tabs">
          <button className={`tab ${activeTab === 'agreements' ? 'active' : ''}`} onClick={() => navigate('/')}>
            My Agreements
          </button>
          <button className={`tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => navigate('/create')}>
            + Create
          </button>
          <button className={`tab ${activeTab === 'business' ? 'active' : ''}`} onClick={() => navigate('/business')}>
            Business Profile
          </button>
        </div>
      )}

      <div className="content">
        {!authenticated ? (
          isAgreementPage ? <SignInForAgreement /> : <Welcome />
        ) : (
          <Routes>
            <Route path="/" element={<AgreementsList />} />
            <Route path="/create" element={<CreateAgreement onCreated={() => navigate('/')} />} />
            <Route path="/business" element={<RegisterBusiness />} />
            <Route path="/agreement/:id" element={<AgreementView />} />
            <Route path="*" element={<AgreementsList />} />
          </Routes>
        )}
      </div>
    </div>
  )
}

export default App