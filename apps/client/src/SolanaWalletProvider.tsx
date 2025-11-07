import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { useMemo } from 'react';

import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaWalletProviderProps {
  children: React.ReactNode;
}

/**
 * Solana Wallet Provider - Configures Solana wallet connection
 * - Network: Solana Mainnet
 * - RPC: publicnode.com (better rate limits than default)
 * - Wallet: Phantom
 */
export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
  const endpoint = useMemo(
    () => import.meta.env.VITE_SOLANA_RPC_URL || "https://solana-rpc.publicnode.com",
    []
  );

  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
