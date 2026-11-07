import { base, baseSepolia } from 'viem/chains'
import LexChainV4 from './LexChainV4.json'

export const NETWORK = import.meta.env.VITE_NETWORK === 'mainnet' ? 'mainnet' : 'sepolia'
export const CHAIN = NETWORK === 'mainnet' ? base : baseSepolia
export const RPC_URL = NETWORK === 'mainnet' ? 'https://mainnet.base.org' : 'https://sepolia.base.org'
export const EXPLORER_URL = NETWORK === 'mainnet' ? 'https://basescan.org' : 'https://sepolia.basescan.org'

const ADDRESSES = {
  sepolia: '0x2d34177e380d0a5721eecbbc8ca06af2eb88f1f1',
  mainnet: '', // filled in at launch (Phase 7)
}

export const LEXCHAIN_ADDRESS = ADDRESSES[NETWORK]
export const LEXCHAIN_ABI = LexChainV4.abi
export const MAX_PARTIES = 20

// Aliases so existing components keep compiling
export const AGREEMENT_REGISTRY_ADDRESS = LEXCHAIN_ADDRESS
export const AGREEMENT_REGISTRY_ABI = LEXCHAIN_ABI