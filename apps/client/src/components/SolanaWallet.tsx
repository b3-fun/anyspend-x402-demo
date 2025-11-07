import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

interface SolanaWalletProps {
  onDisconnect?: () => void;
}

export function SolanaWallet({ onDisconnect }: SolanaWalletProps) {
  const {
    publicKey: solanaPublicKey,
    connected: solanaConnected,
    disconnect: solanaDisconnect,
  } = useWallet();

  const handleDisconnect = async () => {
    await solanaDisconnect();
    if (onDisconnect) {
      onDisconnect();
    }
  };

  return (
    <>
      {/* Header with Wallet Status */}
      <div className="header">
        <div className="header-content">
          <div className="logo-section">
            <img
              src="https://cdn.b3.fun/anyspend-logo-brand.svg"
              alt="AnySpend"
              className="logo"
            />
            <div className="logo-text">
              <p className="subtitle">Premium data on Solana - Pay with USDC</p>
            </div>
          </div>
          <div className="wallet-section">
            {!solanaConnected ? (
              <div className="connector-buttons-header">
                <WalletMultiButton className="button button-small solana-wallet-btn" />
              </div>
            ) : (
              <div className="wallet-header-info">
                <span className="status-badge">
                  ✅ {solanaPublicKey?.toBase58().slice(0, 4)}...
                  {solanaPublicKey?.toBase58().slice(-4)}
                </span>
                <button
                  onClick={handleDisconnect}
                  className="button button-small button-secondary"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Action Card */}
      <div className="card action-card">
        <div className="action-content">
          <div className="action-text">
            <h2>◎ Solana Premium Data</h2>
            <p className="subtitle">
              Access premium data on Solana - Pay with USDC (0.01 USDC)
            </p>
          </div>
          <button
            onClick={() => alert("Solana payment coming soon!")}
            disabled={!solanaConnected}
            className="button button-large"
          >
            ◎ Get Premium Data
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div className="card">
        <h3>Solana Integration Status</h3>
        <p style={{ marginTop: "1rem", color: "var(--text-secondary)" }}>
          Solana wallet connection is ready! Payment integration coming soon.
        </p>
        {solanaConnected && (
          <div style={{ marginTop: "1rem" }}>
            <p style={{ fontWeight: 600 }}>Connected Wallet:</p>
            <p
              style={{
                fontFamily: "monospace",
                fontSize: "0.875rem",
                wordBreak: "break-all",
                marginTop: "0.5rem",
              }}
            >
              {solanaPublicKey?.toBase58()}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
