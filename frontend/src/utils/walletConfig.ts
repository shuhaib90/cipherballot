import { createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { sepolia, hardhat } from '@reown/appkit/networks';

// Get Project ID from WalletConnect Cloud (fall back to a test ID for local dev)
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'b56e18d47c72ab683b1081746919246e';

const metadata = {
  name: 'CipherBallot',
  description: 'Confidential Election System powered by Zama fhEVM',
  url: window.location.origin,
  icons: ['https://avatars.githubusercontent.com/u/104819']
};

export const modal = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [sepolia, hardhat],
  metadata,
  projectId,
  features: {
    analytics: false,
    email: false, // Disable non-Web3 email login
    socials: false // Disable social logins to enforce Web3 wallets only
  },
  excludeWalletIds: [
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96' // Exclude MetaMask
  ]
});
