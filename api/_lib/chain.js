import { createPublicClient, http, parseAbi } from 'viem'
import { base, baseSepolia } from 'viem/chains'

const isMainnet = process.env.LEXCHAIN_NETWORK === 'mainnet'
const address = process.env.LEXCHAIN_ADDRESS

const client = createPublicClient({
  chain: isMainnet ? base : baseSepolia,
  transport: http(isMainnet ? 'https://mainnet.base.org' : 'https://sepolia.base.org'),
})

const abi = parseAbi([
  'struct Party { address wallet; string name; address inviteSigner; uint64 joinedAt; }',
  'struct Member { address wallet; string name; string role; uint8 partyIndex; bool active; uint64 addedAt; address inviteSigner; }',
  'struct Version { string ipfsCID; bytes32 contentHash; string note; uint64 newEndDate; address proposedBy; uint64 proposedAt; uint64 activatedAt; uint8 signCount; uint8 status; }',
  'function getParties(bytes32 id) view returns (Party[])',
  'function getMembers(bytes32 id) view returns (Member[])',
  'function getVersions(bytes32 id) view returns (Version[])',
])

export async function readAgreementAccess(agreementId) {
  const read = (functionName) => client.readContract({ address, abi, functionName, args: [agreementId] })
  const [parties, members, versions] = await Promise.all([
    read('getParties'),
    read('getMembers'),
    read('getVersions'),
  ])
  return { parties, members, versions }
}