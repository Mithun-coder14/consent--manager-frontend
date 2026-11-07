import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import { SmartWalletsProvider } from '@privy-io/react-auth/smart-wallets'
import { WagmiProvider, createConfig } from '@privy-io/wagmi'
import { http } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { CHAIN, RPC_URL } from './contracts/config'
import './index.css'
import App from './App.jsx'

const config = createConfig({
  chains: [CHAIN],
  transports: { [CHAIN.id]: http(RPC_URL) },
})

const queryClient = new QueryClient()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <PrivyProvider
        appId={import.meta.env.VITE_PRIVY_APP_ID}
        config={{
          loginMethods: ['email', 'google', 'wallet'],
          appearance: { theme: 'dark', accentColor: '#8b5cf6' },
          defaultChain: CHAIN,
          supportedChains: [CHAIN],
          embeddedWallets: { ethereum: { createOnLogin: 'all-users' } },
        }}
      >
        <SmartWalletsProvider>
          <QueryClientProvider client={queryClient}>
            <WagmiProvider config={config}>
              <App />
            </WagmiProvider>
          </QueryClientProvider>
        </SmartWalletsProvider>
      </PrivyProvider>
    </BrowserRouter>
  </StrictMode>,
)