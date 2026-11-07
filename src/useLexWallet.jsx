import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { createPublicClient, http } from 'viem'
import { CHAIN, RPC_URL } from './contracts/config'

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL),
})

export function useLexWallet() {
  const { client } = useSmartWallets()
  const address = client?.account?.address

  const sendTx = async ({ to, data }) => {
    if (!client) {
      throw new Error('Your wallet is still loading. Wait a few seconds and try again.')
    }
    const hash = await client.sendTransaction({ to, data, chain: CHAIN })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain')
    return { hash, receipt }
  }

  return { address, sendTx, ready: !!client }
}