# ChapChap Confidential

ChapChap Confidential is an AI-powered confidential finance and agreement assistant built for the Zama Builder Track. It lets users describe payments, savings, and agreements in plain English, then turns those prompts into Sepolia wallet actions and Zama/FHEVM-compatible confidential contract calls.

The app keeps the original ChapChap chat-first experience, but pivots the product to confidential Sepolia flows powered by MetaMask, Django, Next.js, and a Zama FHEVM smart contract.

## Current Product

Users can:

- Send confidential ChapChap transfers using encrypted client-side input.
- Send normal public Sepolia ETH transfers when privacy mode is not needed.
- Deposit ETH and move value into a confidential savings bucket.
- Create agreement escrow drafts from plain English.
- Submit proof and receive AI-assisted verdict recommendations.
- View confidential action history.
- Connect MetaMask on Sepolia and see wallet ETH balance.
- Reveal ChapChap private balance using Zama user decryption where supported.
- Use dark or light mode across the landing page and app.

Important privacy wording:

- Wallet addresses and transaction existence may still be public.
- Public deposits, public transfers, and MVP agreement escrow ETH values are visible onchain.
- Sensitive values such as internal balances, confidential transfer amounts, savings amounts, and internal FHEVM computations can be encrypted where supported by Zama/FHEVM.
- The contract can compute over encrypted values without revealing them to the public.

## Live Flow

1. User signs in with Google.
2. User launches the chat-first dashboard.
3. User connects MetaMask and switches to Sepolia.
4. User types a prompt such as `Send 0.0001 ETH to Ada privately`.
5. Backend parser classifies the prompt and returns a structured action.
6. Frontend renders a confirmation card inside the chat.
7. For confidential values, the frontend encrypts the amount using the Zama Relayer SDK.
8. User confirms the wallet transaction in MetaMask.
9. Frontend records the real transaction hash through the confidential backend API.
10. History shows the submitted action and Sepolia explorer link.

No fake transaction hashes are shown. Backend history is not marked submitted unless a real transaction hash exists.

## Features

### AI Prompt Parser

The confidential parser handles natural-language prompts for:

- `confidential_payment`
- `public_payment`
- `confidential_savings`
- `confidential_agreement`
- `proof_submission`
- `general_help`

It extracts fields such as amount, asset, recipient name, recipient wallet address, deadline, lock rule, transfer mode, and agreement condition. If a critical field is missing, the chat asks for it instead of failing.

Example prompts:

- `Send 0.0001 ETH to Ochi privately`
- `Send 0.0001 ETH publicly to 0x...`
- `Save 0.0001 ETH for 7 days`
- `Create agreement: pay John Doe 0.002 ETH if he delivers the report`
- `Submit proof for my agreement`

### Confidential Payments

Confidential transfers use the deployed `ChapChapConfidentialCore` contract on Sepolia.

For private transfers:

- User must have ETH deposited into the ChapChap contract balance.
- Frontend converts the ETH amount to wei and validates it fits `uint64`.
- Frontend encrypts the amount client-side with the Zama Relayer SDK.
- Contract receives `externalEuint64`, `inputProof`, and a public mirror amount for MVP accounting.
- Recipient receives funds inside their ChapChap private contract balance, not directly in MetaMask.

For public transfers:

- Frontend uses `signer.sendTransaction`.
- Recipient receives normal Sepolia ETH directly in their wallet.
- History stores the action as `public_payment`.

### Private Savings

Savings flow:

- User describes a savings goal in chat.
- Frontend submits a public `deposit()` transaction.
- Frontend encrypts the savings amount.
- Frontend calls `saveConfidential(encryptedAmount, inputProof, publicAmountWei)`.
- Backend records a `SavingsPosition` with lock rule, unlock date, status, and transaction hash.

Savings do not automatically return after the lock period. For the MVP, the UI tracks when savings become withdrawable and exposes withdrawal status. Automated keepers are not included.

### Agreements and Proof

Agreement flow:

- User describes an agreement in plain English.
- Backend extracts recipient, amount, condition, deadline, and proof requirement.
- Frontend hashes agreement metadata.
- User creates an escrow with `createAgreement(recipient, deadline, metadataHash)` and ETH value.
- Proof can be submitted later through the backend.
- Backend returns an AI-assisted recommendation: `release`, `refund`, or `dispute`.

MVP note: agreement escrow ETH value is public in the current contract. Confidential agreement logic is the next layer.

### Private Balance Reveal

The Wallet page and dashboard show:

- Connected wallet address.
- Sepolia ETH wallet balance.
- ChapChap private balance status.
- A `Reveal Private Balance` action.

Only the connected wallet owner can request decryption of their ChapChap private balance.

## Architecture

ChapChap Confidential is split into four main layers.

### Frontend

Next.js App Router with TypeScript and Tailwind CSS.

Responsibilities:

- Landing page at `/`.
- Chat-first assistant dashboard at `/dashboard`.
- Wallet and private balance page at `/wallet`.
- Confidential history page at `/history`.
- Google sign-in UI.
- MetaMask connection and Sepolia checks.
- Zama Relayer SDK initialization and encrypted input generation.
- Contract calls through `ethers`.
- Transaction receipt display and backend tx recording.

### Backend

Django + Django REST Framework.

Responsibilities:

- Google authentication.
- Token-based API auth.
- Confidential prompt parsing.
- Confidential action history.
- Savings position tracking.
- Agreement proof review and AI-assisted verdict recommendations.
- Deployment-safe CORS, allowed-hosts, and health checks.

The backend does not sign Zama contract transactions. Users sign Sepolia transactions from their connected wallet.

### Smart Contracts

Hardhat workspace in `contracts-zama/`.

Main contract:

- `ChapChapConfidentialCore.sol`

Implemented contract surface:

- `deposit() payable`
- `withdraw(uint64 publicAmountWei)`
- `transferConfidential(address recipient, externalEuint64 encryptedAmount, bytes inputProof, uint64 publicAmountWei)`
- `saveConfidential(externalEuint64 encryptedAmount, bytes inputProof, uint64 publicAmountWei)`
- `createAgreement(address recipient, uint256 deadline, bytes32 metadataHash) payable`
- `submitVerdict(uint256 agreementId, bool releaseFunds)`
- `getEncryptedBalance()`
- `getEncryptedSavings()`

Current deployed Sepolia contract:

```text
0xa3D96Dc13BDF9FD34Ae0003ab99E4C686802523A
```

### Database

PostgreSQL in production and local-compatible database configuration for development.

Current confidential models:

- `ConfidentialAction`
- `ConfidentialAgreementRecord`
- `SavingsPosition`

## API Surface

Confidential backend routes:

- `POST /api/confidential/parse/`
- `GET /api/confidential/history/`
- `GET /api/confidential/savings/`
- `POST /api/confidential/savings/{id}/withdraw/`
- `POST /api/confidential/actions/{id}/tx/`
- `POST /api/confidential/agreements/{id}/proof/`

Auth and health routes:

- `POST /api/auth/google/`
- `GET /api/me/`
- `GET /api/health/`

## Repository Structure

```text
chapchap/
  chapchap-frontend/
    app/
      page.tsx                 Landing page
      dashboard/page.tsx       Chat-first assistant app
      wallet/page.tsx          Wallet, balance, savings, private balance reveal
      history/page.tsx         Confidential action history
    components/
      dashboard-screen.tsx     Main assistant chat flow
      chat-message.tsx         Assistant/user messages and action cards
      private-balance-card.tsx Private balance reveal UI
      transaction-list.tsx     Confidential history list
      providers/               Auth, wallet, and theme providers
    lib/
      api/confidential.ts      Confidential backend API client
      api/auth.ts              Google auth and user API client
      contracts/               Frontend-local ABI and contract helpers
      zamaClient.ts            Zama Relayer SDK encryption/decryption helper
      types.ts                 Shared frontend types

  chapchap-backend/
    backend/
      apps/
        authn/                 Google auth and linked auth records
        confidential/          Parser, history, savings, agreements, proof review
        users/                 Custom user model and profile endpoints
        ai_agent/              AI support services retained for assistant flows
      config/                  Django settings, URLs, deployment config
      shared/                  Health check and shared utilities
    requirements.txt

  contracts-zama/
    contracts/
      ChapChapConfidentialCore.sol
    scripts/
      deploy.js
    hardhat.config.js

  contracts/                   Legacy Etherlink contract workspace
  scripts/                     Legacy helper scripts
```

Legacy Etherlink-oriented folders remain in the repository for compatibility/history, but the current Zama product path uses the `chapchap-frontend`, `chapchap-backend/apps/confidential`, and `contracts-zama` flows described above.

## Local Setup

### 1. Backend

```bash
cd chapchap-backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create `chapchap-backend/backend/.env` using `chapchap-backend/.env.example` as a guide.

Run:

```bash
python backend/manage.py migrate
python backend/manage.py runserver
```

Backend defaults to:

```text
http://127.0.0.1:8000
```

### 2. Frontend

```bash
cd chapchap-frontend
npm install
```

Create `chapchap-frontend/.env.local` using `chapchap-frontend/.env.local.example` as a guide.

Run:

```bash
npm run dev
```

Frontend defaults to:

```text
http://localhost:3000
```

### 3. Zama Contracts

```bash
cd contracts-zama
npm install
npm run compile
```

Deploy to Sepolia:

```bash
npm run deploy:sepolia
```

## Environment Variables

### Frontend

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
NEXT_PUBLIC_ENABLE_DEV_AUTH=false
NEXT_PUBLIC_ZAMA_CORE_CONTRACT_ADDRESS=0xa3D96Dc13BDF9FD34Ae0003ab99E4C686802523A
NEXT_PUBLIC_ZAMA_CHAIN_ID=11155111
NEXT_PUBLIC_ZAMA_EXPLORER_BASE_URL=https://sepolia.etherscan.io
NEXT_PUBLIC_ZAMA_SDK_SOURCE=package
```

Optional frontend overrides:

```env
NEXT_PUBLIC_ZAMA_RELAYER_URL=https://relayer.testnet.zama.org
NEXT_PUBLIC_ZAMA_SDK_CDN_URL=https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.js
```

Do not expose Google client secrets or private keys through `NEXT_PUBLIC_*` variables.

### Backend

```env
DJANGO_SETTINGS_MODULE=config.settings.dev
SECRET_KEY=change-me
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CORS_ALLOWED_ORIGIN_REGEXES=^https://.*\.vercel\.app$
CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
DATABASE_URL=your-database-url
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_VERIFY_AUDIENCE=True
GOOGLE_AUTH_HTTP_TIMEOUT_SECONDS=10
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3-flash-preview
SEPOLIA_RPC_URL=https://your-sepolia-rpc
ZAMA_CORE_CONTRACT_ADDRESS=0xa3D96Dc13BDF9FD34Ae0003ab99E4C686802523A
ZAMA_CHAIN_ID=11155111
ZAMA_EXPLORER_BASE_URL=https://sepolia.etherscan.io
```

### Contracts

```env
SEPOLIA_RPC_URL=https://your-sepolia-rpc
SEPOLIA_PRIVATE_KEY=your-deployer-private-key
```

Never commit real `.env` files or private keys.

## Deployment Notes

Frontend deployment:

- Vercel root directory should be `chapchap-frontend`.
- Build command: `npm run build`.
- Output is handled by Next.js.
- Set all required `NEXT_PUBLIC_*` variables in Vercel.

Backend deployment:

- Render root directory should be `chapchap-backend`.
- Run migrations before or during deploy.
- Use `DJANGO_SETTINGS_MODULE=config.settings.prod`.
- Set `DEBUG=False`.
- Set `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS` for the deployed frontend domain.

Production URLs used during current development:

- Frontend: `https://chapchap-rho.vercel.app`
- Backend: `https://chapchap-at9y.onrender.com`
- Explorer: `https://sepolia.etherscan.io`

## Verification

Frontend:

```bash
cd chapchap-frontend
npm run lint
npm run build
```

Backend:

```bash
cd chapchap-backend
.venv\Scripts\activate
python backend/manage.py check
```

Contracts:

```bash
cd contracts-zama
npm run compile
```

## MVP Limitations

- First backend request on a free Render service can be slow while the service wakes.
- Confidential transfers require the sender to have deposited into their ChapChap contract balance first.
- `euint64` limits supported ETH amounts to tiny testnet values for the MVP.
- Agreement escrow ETH is public in the current contract.
- Savings unlock tracking exists in the backend/UI, but no automated keeper returns funds automatically.
- Zama relayer availability can affect encrypted input generation. The app retries and offers public transfer fallback.

## License

MIT
