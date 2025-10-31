# AnySpend x402 Fullstack Demo

A complete fullstack application demonstrating **AnySpend x402** - a payment protocol that lets customers pay with any token (ETH, DAI, any ERC-20) while sellers receive USDC. This demo uses a **remote facilitator** for blockchain payment verification, token swaps, and settlement.

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  React Client   │────────▶│  Express Server │────────▶│  AnySpend       │
│  (Browser)      │         │  (Your Backend) │         │  Facilitator    │
│                 │         │                 │         │ (anyspend.com)  │
│ • Creates       │         │ • Receives      │         │                 │
│   payment with  │         │   X-PAYMENT     │         │ • Verifies      │
│   ANY token     │         │   header        │         │   signatures    │
│ • Signs with    │         │ • Calls remote  │         │ • Swaps tokens  │
│   private key   │         │   facilitator   │         │   to USDC       │
│ • Never sends   │         │ • No blockchain │         │ • Settles to    │
│   key to server │         │   node needed   │         │   seller        │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

## Key Features

- **Pay with Any Token**: Customers can pay with ETH, DAI, or any ERC-20 token across 19+ networks
- **Receive Only USDC**: Sellers always receive payments in USDC regardless of customer's payment token
- **Automatic Token Swaps**: AnySpend facilitator handles all token conversions seamlessly
- **No Blockchain Infrastructure**: Server uses remote facilitator instead of running blockchain nodes
- **Gasless Payments**: Uses ERC-2612 permits for gas-free token approvals
- **Fast Verification**: Payment verification happens off-chain via remote facilitator
- **On-Chain Settlement**: Facilitator handles actual blockchain transactions and token swaps
- **Secure**: Private keys never leave the browser

## What is AnySpend?

AnySpend is a B3-maintained fork of Coinbase's x402 payment protocol that enables universal cryptocurrency payments over HTTP. The key innovation: **customers pay with any token, sellers receive USDC**.

### How the AnySpend Facilitator Works

The AnySpend facilitator handles all blockchain complexity on behalf of your application:

- **Multi-Token Support**: Accepts payments in ETH, DAI, or any ERC-20 token across 19+ networks
- **Automatic Conversion**: Swaps customer's payment token to USDC seamlessly
- **Verification**: Fast off-chain validation of payment signatures and balances
- **Settlement**: On-chain execution of approved transactions
- **No Infrastructure**: You don't need to run blockchain nodes or manage keys
- **Production Ready**: Use the mainnet facilitator at `https://mainnet.anyspend.com/x402`

## Project Structure

```
anyspend-fullstack/
├── apps/
│   ├── client/          # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── App.tsx       # Main React component
│   │   │   ├── App.css       # Styles
│   │   │   └── main.tsx      # Entry point
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── .env.example
│   │
│   └── server/          # Express backend
│       ├── index.ts          # Express app with x402 integration
│       ├── package.json
│       ├── tsconfig.json
│       └── .env.example
│
├── package.json         # Root workspace config
├── pnpm-workspace.yaml  # PNPM workspace definition
└── README.md
```

## Prerequisites

- Node.js 18+ and pnpm
- A wallet with USDC on Base Sepolia testnet
- (Optional) Your own facilitator instance

## Setup

### 1. Install Dependencies

From the root directory:

```bash
pnpm install
```

### 2. Configure Server

Create `apps/server/.env`:

```bash
cp apps/server/.env.example apps/server/.env
```

Edit `apps/server/.env`:

```env
PORT=3001

# Use the AnySpend mainnet facilitator (accepts any token, pays out in USDC)
FACILITATOR_URL=https://mainnet.anyspend.com/x402

# Or use your own facilitator
# FACILITATOR_URL=https://your-facilitator.example.com
# FACILITATOR_VERIFY_TOKEN=your-verify-token
# FACILITATOR_SETTLE_TOKEN=your-settle-token

# Payment configuration
NETWORK=base-sepolia
PAYMENT_AMOUNT=1000000  # 1 USDC (6 decimals)
PAYTO_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0

# For permit-based payments, specify the facilitator's execution address
FACILITATOR_ADDRESS=
```

### 3. Configure Client (Optional)

Create `apps/client/.env` if you want to use a different API URL:

```bash
cp apps/client/.env.example apps/client/.env
```

Edit `apps/client/.env`:

```env
VITE_API_URL=http://localhost:3001
```

## Running the Application

### Development Mode (Both Apps)

Start both client and server with hot reload:

```bash
pnpm dev
```

This will start:
- React client at `http://localhost:3000`
- Express server at `http://localhost:3001`

### Run Individually

**Server only:**
```bash
pnpm dev:server
```

**Client only:**
```bash
pnpm dev:client
```

## How It Works

### Client Flow (React)

1. **User enters private key** in the browser (never sent to server)
2. **Initial request** to `/api/premium` receives `402 Payment Required`
3. **Create payment header** using AnySpend x402 client library (can pay with any token)
4. **Retry request** with `X-PAYMENT` header containing signed permit
5. **AnySpend converts** customer's token to USDC automatically
6. **Receive premium content** after payment is verified, swapped, and settled

### Server Flow (Express with Middleware)

The `paymentMiddleware` from `@b3dotfun/anyspend-x402` automatically handles the entire payment flow:

1. **Receive request** without payment → middleware returns `402` with payment requirements
2. **Receive request** with `X-PAYMENT` header → middleware decodes payment payload
3. **Verify payment** → middleware calls AnySpend facilitator (off-chain, fast)
4. **Execute route handler** → only if payment is valid
5. **Settle & convert payment** → middleware handles token swap and settlement via AnySpend (on-chain)
6. **Return response** → middleware adds `X-PAYMENT-RESPONSE` header with settlement details

Your route handler only runs after payment is verified and settled! Seller receives USDC regardless of customer's payment token.

### Code Snippets

**Client: Creating Payment**
```typescript
import { createPaymentHeader } from 'x402/client';
import { createSignerSepolia } from 'x402/types/shared/evm';

// Create wallet from private key (stays in browser)
const wallet = createSignerSepolia(privateKey);

// Create payment header
const paymentHeader = await createPaymentHeader(
  wallet,
  1,  // nonce
  paymentRequirement
);

// Make request with payment
const response = await fetch('/api/premium', {
  method: 'POST',
  headers: { 'X-PAYMENT': paymentHeader }
});
```

**Server: Using Payment Middleware**
```typescript
import { paymentMiddleware } from '@b3dotfun/anyspend-x402/express';

// Apply payment middleware to protected routes
app.use(
  paymentMiddleware(
    "0xYourAddress", // your receiving wallet address (gets USDC)
    {
      "POST /api/premium": {
        price: "$0.001",  // USDC amount (customer can pay with any token)
        network: "base-sepolia",
        config: {
          description: "Access to premium market analysis data",
          mimeType: "application/json",
        },
      },
    },
    {
      url: "https://mainnet.anyspend.com/x402", // AnySpend facilitator
    },
  ),
);

// Your route handler - payment already verified, swapped, and settled by middleware
app.post("/api/premium", (req, res) => {
  res.json({ data: generatePremiumData() });
});
```

**Alternative: Manual Verification (Not Recommended)**

If you need more control, you can manually use the AnySpend facilitator:

```typescript
import { useFacilitator } from '@b3dotfun/anyspend-x402/verify';
import { decodePayment } from '@b3dotfun/anyspend-x402/schemes/exact/evm';

// Configure AnySpend facilitator
const facilitator = useFacilitator({
  url: 'https://mainnet.anyspend.com/x402'
});

// Decode payment (customer can pay with any token)
const paymentPayload = decodePayment(paymentHeader);

// Verify with AnySpend facilitator (fast, off-chain)
const verifyResult = await facilitator.verify(
  paymentPayload,
  PAYMENT_REQUIREMENTS
);

// Settle with AnySpend facilitator (on-chain, swaps to USDC)
const settleResult = await facilitator.settle(
  paymentPayload,
  PAYMENT_REQUIREMENTS
);
```

## API Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "facilitator": "https://mainnet.anyspend.com/x402",
  "network": "base-sepolia"
}
```

### `GET /api/facilitator/supported`
Check what networks and schemes the facilitator supports.

### `GET /api/free`
Free endpoint that doesn't require payment.

### `POST /api/premium`
Premium endpoint that requires payment.

**Without payment:**
- Returns `402 Payment Required`
- Includes payment requirements in response

**With valid payment:**
- Returns `200 OK`
- Includes `X-PAYMENT-RESPONSE` header with settlement details
- Returns premium market analysis data

## Testing

1. Get Base Sepolia testnet ETH from a faucet
2. Get USDC on Base Sepolia (contract: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`)
3. Open `http://localhost:3000`
4. Enter your private key
5. Click "Get Premium Data (Pay 1 USDC)"
6. Watch the transaction log as payment is verified and settled

## Building for Production

```bash
pnpm build
```

This builds both apps:
- Server → `apps/server/dist/`
- Client → `apps/client/dist/`

## Environment Variables

### Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Server port |
| `FACILITATOR_URL` | No | `https://mainnet.anyspend.com/x402` | AnySpend facilitator URL |
| `NETWORK` | No | `base-sepolia` | Blockchain network |
| `PAYMENT_AMOUNT_USD` | No | `$0.001` | Payment amount in USD (you receive USDC) |
| `PAYTO_ADDRESS` | Yes | - | Address to receive USDC payments |

### Client

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `http://localhost:3001` | Backend API URL |

## Security Notes

- Private keys are only used in the browser and never sent to the server
- The server only receives signed payment permits
- The remote facilitator verifies signatures and balances before settlement
- Use HTTPS in production for all communication

## Learn More

- [AnySpend x402 GitHub](https://github.com/b3-fun/anyspend-x402)
- [x402 Documentation](https://x402.org/docs)
- [ERC-2612 Permit Standard](https://eips.ethereum.org/EIPS/eip-2612)
- [B3 Fun](https://b3.fun)

## License

MIT
