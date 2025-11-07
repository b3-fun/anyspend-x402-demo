import {
    createSigner,
    decodeXPaymentResponse,
    wrapFetchWithPayment,
} from "@b3dotfun/anyspend-x402-fetch";
import { config } from "dotenv";

config();

const privateKey = process.env.SOLANA_PRIVATE_KEY as string;
// Force local server for Solana testing
const baseURL = "http://localhost:3001";
const endpointPath = "/api/solana/premium";
const url = `${baseURL}${endpointPath}`;

if (!privateKey) {
  console.error("❌ Missing SOLANA_PRIVATE_KEY environment variable");
  console.log("\nTo use this script, you need to set your Solana private key:");
  console.log("1. Create a .env file in this directory");
  console.log("2. Add: SOLANA_PRIVATE_KEY=<your-base58-private-key>");
  console.log("\nYou can generate a new keypair with:");
  console.log("  solana-keygen new --outfile ~/solana-wallet.json");
  console.log("  cat ~/solana-wallet.json\n");
  process.exit(1);
}

/**
 * Solana Payment Test Script
 *
 * This example demonstrates how to make a payment to a Solana endpoint
 * using the x402 protocol with USDC on Solana mainnet.
 *
 * Prerequisites:
 * - Solana private key in .env file (SOLANA_PRIVATE_KEY)
 * - USDC balance on Solana mainnet
 * - Server running at http://localhost:3001
 * - Facilitator running at http://localhost:8080/x402
 */
async function main(): Promise<void> {
  console.log("🌐 Solana X402 Payment Test");
  console.log("=============================");
  console.log(`📍 Target URL: ${url}`);
  console.log(`🔗 Network: solana (mainnet)`);
  console.log(`💰 Payment: 0.01 USDC (10000 with 6 decimals)`);
  console.log("");

  try {
    // Create Solana signer
    console.log("🔑 Creating Solana signer...");
    const originalSigner = await createSigner("solana", privateKey);
    console.log(`✅ Signer created: ${originalSigner.account}`);
    console.log("Signer object keys:", Object.keys(originalSigner));

    // Wrap signer to log what signTransactions receives and returns
    const signer = {
      ...originalSigner,
      signTransactions: async (transactions: any[]) => {
        console.log("\n=== signTransactions called ===");
        console.log("Input transactions:", transactions);
        console.log("Input transaction[0] keys:", Object.keys(transactions[0]));

        const result = await originalSigner.signTransactions(transactions);

        console.log("Output result:", result);
        console.log("Output result type:", result.constructor.name);
        console.log("Output result[0] type:", result[0]?.constructor.name);
        console.log("Output result[0] length:", result[0]?.length);
        console.log("=== signTransactions done ===\n");

        return result;
      }
    };

    console.log("");

    // Wrap fetch with payment support
    const fetchWithPayment = wrapFetchWithPayment(fetch, signer);

    // Make the payment request
    console.log("💳 Making payment request...");
    const response = await fetchWithPayment(url, { method: "POST" });

    console.log(`📡 Response status: ${response.status} ${response.statusText}`);

    // Parse response body
    const body = await response.json();
    console.log("\n📦 Response body:");
    console.log(JSON.stringify(body, null, 2));

    // Decode and display payment response
    const paymentResponseHeader = response.headers.get("x-payment-response");
    if (paymentResponseHeader) {
      const paymentResponse = decodeXPaymentResponse(paymentResponseHeader);
      console.log("\n💎 Payment Response:");
      console.log(JSON.stringify(paymentResponse, null, 2));

      if (paymentResponse.transaction) {
        console.log("\n🔗 Transaction on Solana Explorer:");
        console.log(`https://explorer.solana.com/tx/${paymentResponse.transaction}`);
        console.log("\n🔗 Transaction on Solscan:");
        console.log(`https://solscan.io/tx/${paymentResponse.transaction}`);
      }
    }

    console.log("\n✅ Payment test completed successfully!");
  } catch (error: unknown) {
    console.error("\n❌ Payment test failed:");

    if (error && typeof error === "object" && "response" in error) {
      const errorWithResponse = error as { response: { status: number; data: unknown } };
      console.error(`Status: ${errorWithResponse.response.status}`);
      console.error(`Data:`, errorWithResponse.response.data);
    } else if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error(error);
    }

    console.log("\n💡 Troubleshooting:");
    console.log(
      "1. Ensure the server is running: cd ../../../fullstack/anyspend/apps/server && npm run dev",
    );
    console.log("2. Check your USDC balance on Solana mainnet");
    console.log("3. Verify your Solana private key is correct");
    console.log("4. Ensure the facilitator is running at http://localhost:8080/x402");

    process.exit(1);
  }
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
