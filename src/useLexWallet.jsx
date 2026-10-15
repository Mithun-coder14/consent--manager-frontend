import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

export const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
})

export function useLexWallet() {
  const { client } = useSmartWallets()
  const address = client?.account?.address

  const sendTx = async ({ to, data }) => {
    if (!client) {
      throw new Error('Smart wallet is still loading. Wait a few seconds and try again.')
    }
    const hash = await client.sendTransaction({ to, data })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error('Transaction reverted on-chain')
    }
    return hash
  }

  return { address, sendTx, ready: !!client }
}