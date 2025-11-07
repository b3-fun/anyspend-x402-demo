/**
 * Solana Wallet Component - X402 Payment Integration
 *
 * Demonstrates how to integrate Solana payments with the x402 protocol using browser wallet adapters.
 *
 * Key features:
 * - Connects to Solana wallets (Phantom) via wallet-adapter
 * - Creates a TransactionSigner compatible with @solana/kit
 * - Converts between @solana/web3.js v2 format (used by x402) and v1 VersionedTransaction (used by wallet adapters)
 * - Handles payment flow: sign -> verify -> settle
 * - Displays payment confirmation and transaction links
 *
 * @see https://docs.anyspend.com/x402 for protocol documentation
 */

import {
  decodeXPaymentResponse,
  wrapFetchWithPayment,
} from "@b3dotfun/anyspend-x402-fetch";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import { useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const SOLANA_RPC_URL = "https://solana-rpc.publicnode.com";

interface SolanaWalletProps {
  onDisconnect?: () => void;
}

interface PaymentInfo {
  status: string;
  payer?: string;
  transaction?: string;
  network?: string;
  error?: string;
}

interface PremiumData {
  message: string;
  network: string;
  paymentToken: string;
  amount: string;
  timestamp: string;
}

export function SolanaWallet({ onDisconnect }: SolanaWalletProps) {
  const {
    publicKey: solanaPublicKey,
    connected: solanaConnected,
    disconnect: solanaDisconnect,
    signAllTransactions,
  } = useWallet();

  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [premiumData, setPremiumData] = useState<PremiumData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<{
    stage: "idle" | "signing" | "verifying" | "settling" | "complete";
    message: string;
  }>({ stage: "idle", message: "" });

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `${timestamp}: ${message}`]);
  };

  const handleDisconnect = async () => {
    await solanaDisconnect();
    if (onDisconnect) {
      onDisconnect();
    }
  };

  /**
   * Fetches premium data using x402 payment protocol
   *
   * Payment flow:
   * 1. Create a TransactionSigner adapter for the wallet
   * 2. Wrap fetch with payment capability
   * 3. Make request - library handles 402 response and payment automatically
   * 4. Decode payment response header
   * 5. Display premium data
   */
  const fetchPremiumData = async () => {
    if (!solanaConnected || !solanaPublicKey || !signAllTransactions) {
      setError("Please connect your wallet first");
      return;
    }

    setLoading(true);
    setLogs([]);
    setError(null);
    setPaymentInfo(null);
    setPremiumData(null);
    setPaymentStatus({ stage: "idle", message: "" });

    try {
      addLog(`🔐 Connected wallet: ${solanaPublicKey.toBase58()}`);
      addLog(`🌐 Network: Solana Mainnet`);
      addLog(`💰 Payment: 0.01 USDC`);

      setPaymentStatus({
        stage: "signing",
        message: "Preparing payment signature...",
      });
      addLog("🔧 Setting up payment-enabled fetch...");

      /**
       * Create a Solana TransactionSigner compatible with @solana/kit
       *
       * The x402 library expects a signer with:
       * - address: string (wallet public key)
       * - signTransactions: function that takes v2 transactions and returns signatures
       *
       * Transaction format (v2): { messageBytes: Uint8Array, signatures: Record<string, null>, lifetimeConstraint: {...} }
       * Return format: [{ walletAddress: Uint8Array(64) }] - just the 64-byte signature
       */
      const solanaSigner: any = {
        address: solanaPublicKey.toBase58(),
        signTransactions: async (transactions: any[]) => {
          addLog(`Signing ${transactions.length} transaction(s)...`);

          // Convert v2 transactions to VersionedTransaction for wallet signing
          const txsToSign = transactions.map((tx) => {
            if (tx instanceof VersionedTransaction) {
              return tx;
            }

            if (tx.messageBytes instanceof Uint8Array) {
              // Construct a full transaction from messageBytes
              // Format: [numSigs(1 byte), sig1(64 bytes), sig2(64 bytes), ..., message]
              const numSignatures = Object.keys(tx.signatures || {}).length;
              const signaturesLength = 1 + (numSignatures * 64);
              const fullTx = new Uint8Array(signaturesLength + tx.messageBytes.length);

              fullTx[0] = numSignatures;
              fullTx.set(tx.messageBytes, signaturesLength);

              return VersionedTransaction.deserialize(fullTx);
            }

            throw new Error("Unsupported transaction format");
          });

          // Sign transactions with wallet adapter
          const signedTxs = await signAllTransactions!(txsToSign);

          // Extract and return ONLY the signatures (not full serialized transaction)
          return signedTxs.map((signedTx) => {
            const signerIndex = signedTx.message.staticAccountKeys.findIndex(
              key => key.toBase58() === solanaPublicKey.toBase58()
            );

            if (signerIndex === -1) {
              throw new Error("Wallet address not found in transaction signers");
            }

            return {
              [solanaPublicKey.toBase58()]: signedTx.signatures[signerIndex]
            };
          });
        },
      };

      // Wrap fetch with payment capability
      const fetchWithPayment = wrapFetchWithPayment(
        fetch,
        solanaSigner,
        undefined, // Let server determine max amount
        undefined, // Use default payment selector
        { svmConfig: { rpcUrl: SOLANA_RPC_URL } }
      );

      setPaymentStatus({
        stage: "signing",
        message: "Please sign the payment in your wallet...",
      });
      addLog("📡 Making request to server (payment will be handled automatically)...");

      try {
        setPaymentStatus({
          stage: "verifying",
          message: "Verifying payment signature...",
        });

        // Make the payment request - fetchWithPayment handles 402 response automatically
        const endpoint = `${API_BASE_URL}/api/solana/premium`;
        const response = await fetchWithPayment(endpoint, { method: "POST" });

        setPaymentStatus({
          stage: "settling",
          message: "Settling payment on-chain...",
        });
        addLog(`✅ Server responded with status: ${response.status}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || errorData.error || "Request failed");
        }

        // Decode payment confirmation from response header
        const paymentResponseHeader = response.headers.get("X-PAYMENT-RESPONSE");
        if (paymentResponseHeader) {
          const paymentInfo = decodeXPaymentResponse(paymentResponseHeader);
          addLog(`✅ Payment ${paymentInfo.success ? "settled" : "verified"}`);
          if (paymentInfo.transaction) {
            addLog(`Transaction: ${paymentInfo.transaction}`);
          }
          setPaymentInfo({
            status: paymentInfo.success ? "settled" : "verified",
            payer: paymentInfo.payer,
            transaction: paymentInfo.transaction,
            network: paymentInfo.network,
          });
        }

        setPaymentStatus({
          stage: "complete",
          message: "Payment successful! Loading data...",
        });
        const data = await response.json();
        addLog(`🎉 Premium content received!`);

        setPremiumData(data.data);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Unknown error";
        addLog(`❌ Error during payment: ${message}`);
        throw fetchError;
      }
    } catch (err) {
      let message = "Unknown error";

      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === "object" && err !== null) {
        const errObj = err as any;
        if (errObj.shortMessage) message = errObj.shortMessage;
        else if (errObj.reason) message = errObj.reason;
        else if (errObj.message) message = errObj.message;
        else if (errObj.error?.message) message = errObj.error.message;
      } else {
        message = String(err);
      }

      if (message.includes("User rejected") || message.includes("User denied")) {
        addLog(`❌ Error: Signature request was rejected`);
        setError("Signature request was rejected by user");
      } else {
        addLog(`❌ Error: ${message}`);
        setError(message);
      }
    } finally {
      setLoading(false);
      setTimeout(() => {
        setPaymentStatus({ stage: "idle", message: "" });
      }, 2000);
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
            onClick={fetchPremiumData}
            disabled={!solanaConnected || loading}
            className="button button-large"
          >
            {loading ? "⏳ Processing..." : "◎ Get Premium Data"}
          </button>
        </div>
      </div>

      {/* Loading Modal */}
      {loading && (
        <div className="modal-overlay">
          <div className="modal loading-modal">
            <div className="loading-modal-content">
              <div className="payment-status-spinner">
                <div className={`spinner stage-${paymentStatus.stage}`}></div>
              </div>
              <div className="payment-status-text">
                <h2>{paymentStatus.message || "Processing payment..."}</h2>
                <div className="payment-status-steps">
                  <div
                    className={`status-step ${paymentStatus.stage === "signing" || paymentStatus.stage === "verifying" || paymentStatus.stage === "settling" || paymentStatus.stage === "complete" ? "active" : ""} ${paymentStatus.stage === "verifying" || paymentStatus.stage === "settling" || paymentStatus.stage === "complete" ? "completed" : ""}`}
                  >
                    <span className="step-number">1</span>
                    <span className="step-label">Sign</span>
                  </div>
                  <div className="status-connector"></div>
                  <div
                    className={`status-step ${paymentStatus.stage === "verifying" || paymentStatus.stage === "settling" || paymentStatus.stage === "complete" ? "active" : ""} ${paymentStatus.stage === "settling" || paymentStatus.stage === "complete" ? "completed" : ""}`}
                  >
                    <span className="step-number">2</span>
                    <span className="step-label">Verify</span>
                  </div>
                  <div className="status-connector"></div>
                  <div
                    className={`status-step ${paymentStatus.stage === "settling" || paymentStatus.stage === "complete" ? "active" : ""} ${paymentStatus.stage === "complete" ? "completed" : ""}`}
                  >
                    <span className="step-number">3</span>
                    <span className="step-label">Settle</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      <div className="results-section">
        {logs.length > 0 && (
          <div className="card logs-card">
            <h2>📜 Transaction Log</h2>
            <div className="logs">
              {logs.map((log, i) => (
                <div key={i} className="log-entry">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="card error-card">
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        )}

        {paymentInfo && (
          <div className="card payment-card">
            <h2>✅ Payment Confirmed</h2>
            <div className="payment-details">
              <div className="detail">
                <span className="label">Status:</span>
                <span className="value">{paymentInfo.status}</span>
              </div>
              {paymentInfo.payer && (
                <div className="detail">
                  <span className="label">Payer:</span>
                  <span className="value mono">{paymentInfo.payer}</span>
                </div>
              )}
              {paymentInfo.transaction && (
                <>
                  <div className="detail">
                    <span className="label">Transaction:</span>
                    <a
                      href={`https://explorer.solana.com/tx/${paymentInfo.transaction}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="value link mono"
                    >
                      {paymentInfo.transaction}
                    </a>
                  </div>
                  <div className="detail">
                    <span className="label">Network:</span>
                    <span className="value">{paymentInfo.network}</span>
                  </div>
                  <div className="detail">
                    <span className="label">View on Solscan:</span>
                    <a
                      href={`https://solscan.io/tx/${paymentInfo.transaction}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="value link"
                    >
                      View Transaction
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {premiumData && (
          <div className="card content-card">
            <div className="content-header">
              <h2>◎ Solana Premium Data</h2>
              <span className="badge">✨ PAID</span>
            </div>

            <div className="section">
              <h3>🎉 Payment Success!</h3>
              <div className="analysis-grid">
                <div className="stat">
                  <span className="stat-label">Message</span>
                  <p className="stat-value">{premiumData.message}</p>
                </div>
                <div className="stat">
                  <span className="stat-label">Network</span>
                  <p className="stat-value">{premiumData.network}</p>
                </div>
                <div className="stat">
                  <span className="stat-label">Payment Token</span>
                  <p className="stat-value">{premiumData.paymentToken}</p>
                </div>
                <div className="stat">
                  <span className="stat-label">Amount</span>
                  <p className="stat-value">{premiumData.amount}</p>
                </div>
              </div>
            </div>

            <div className="timestamp">
              Data fetched at {new Date(premiumData.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
