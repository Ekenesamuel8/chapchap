<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/5e32d78e-bfde-4c43-8e71-4bb573282520" />

# ChapChap

## ChapChap Confidential

ChapChap Confidential is the current Zama Builder Track version of the project. It pivots the original conversational wallet into an AI-powered private payments, savings, and agreements assistant on Sepolia with Zama/FHEVM-compatible flows.

Current confidential highlights:

- confidential transfers that update private ChapChap balances inside the contract
- public or confidential Sepolia ETH transfer choice
- private savings deposits with explicit unlock and withdraw UX
- AI-parsed agreement drafts plus proof review recommendations
- MetaMask + Sepolia frontend flow with Zama relayer-based encrypted inputs

Important privacy wording:

- wallet addresses and transaction existence may still be public
- sensitive values can be encrypted where supported by Zama/FHEVM
- agreement escrow amounts are still public in the current MVP unless explicitly moved into a confidential contract path later

## Zama / Sepolia setup

Frontend example variables:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_ZAMA_CORE_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT
NEXT_PUBLIC_ZAMA_CHAIN_ID=11155111
NEXT_PUBLIC_ZAMA_EXPLORER_BASE_URL=https://sepolia.etherscan.io
```

Backend example variables:

```env
SEPOLIA_RPC_URL=https://your-sepolia-rpc
ZAMA_CORE_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT
ZAMA_CHAIN_ID=11155111
ZAMA_EXPLORER_BASE_URL=https://sepolia.etherscan.io
```

Use placeholders or safe public contract addresses only. Do not commit private keys or live secret values.

ChapChap is an AI-powered wallet assistant built for Tezos EVM on Etherlink. It helps users interact with crypto through natural language instead of complex wallet interfaces, making common actions like funding a wallet, sending assets, reviewing transactions, and exploring adjacent product flows more approachable for everyday users. The project combines conversational AI, a mobile-first frontend, a Django backend, and real Etherlink testnet integration to create a beginner-friendly onchain experience.

## Problem

Crypto products still assume too much prior knowledge.

For many users, especially non-technical users, even simple actions like sending tokens or funding a wallet involve too many unfamiliar concepts:

- wallet addresses are intimidating
- transaction confirmation screens are confusing
- balances and networks are hard to interpret
- product and payment flows feel fragmented
- the user has to learn blockchain UX before they can complete basic tasks

This creates a major adoption barrier. People who are comfortable chatting in plain language are often blocked by interfaces that expect them to understand wallets, RPC networks, gas, token standards, and transaction details upfront.

## Solution

ChapChap turns a crypto wallet into a conversational assistant.

Instead of forcing users to navigate Web3 using technical forms, ChapChap allows them to express intent in plain English. A user can sign in, get an automatically created wallet, fund it, and then tell the assistant what they want to do. ChapChap interprets the request, gathers missing information through follow-up questions, prepares a clear confirmation step, and then executes supported onchain actions on Etherlink testnet.

The result is a more natural and beginner-friendly wallet experience that feels closer to messaging an assistant than operating a traditional crypto interface.

## Why This Matters

ChapChap matters because accessibility is still one of the biggest problems in Web3.

A conversational wallet lowers the learning curve for users who are new to crypto by replacing rigid transaction forms with guided interaction. AI adds value by helping users describe what they want in natural language, while blockchain provides real ownership, transparent execution, and verifiable transaction history.

This combination is especially useful for:

- first-time crypto users
- users in mobile-first markets
- users who want action-oriented flows instead of technical wallet menus
- users who may understand their intent but not the exact blockchain mechanics needed to carry it out

ChapChap aims to bridge that gap by making crypto actions easier to understand without hiding the importance of confirmation and onchain accountability.

## Core Features

- Google sign-in for easy onboarding
- automatic custodial wallet creation for each user
- wallet address display and copy flow
- fund wallet flow with supported asset and network guidance
- XTZ balance display on Etherlink testnet
- send and receive XTZ on Etherlink testnet
- AI-powered natural language payment intent parsing
- conversational follow-up flow for incomplete payment requests
- clear transaction confirmation flow before submission
- transaction history backed by PostgreSQL
- product search support with store links
- portfolio and investment prompt support
- scheduled payments support in stored/demo-safe mode
- savings flow in demo mode
- gift card flow in demo mode

## AI Functionality

AI is a meaningful part of ChapChap, not just a cosmetic chatbot layer.

ChapChap uses AI to make wallet interactions more usable and more natural:

- Natural language parsing  
  Users can describe payment requests in plain English, and the assistant interprets the intent, amount, asset, timing, and recipient context.

- Conversational flow  
  If a request is incomplete, ChapChap asks for the missing information instead of failing or forcing the user into a separate form.

- Suggestions and guidance  
  The assistant can guide users through supported actions and provide context-aware follow-up prompts.

- Portfolio and investment prompts  
  Users can ask questions like `How do I invest?` or `Analyze my portfolio and suggest investment`, and ChapChap responds with educational guidance informed by wallet context where available.

- Shopping and product search assistance  
  ChapChap can help users explore product-related prompts by returning practical shopping links and related suggestions.

To keep the system efficient and resilient, the app uses deterministic logic where possible and relies on LLM calls only when they add real value.

## Etherlink / Tezos EVM Integration

ChapChap is built around Etherlink testnet as its live blockchain environment.

Current Etherlink integration includes:

- wallet balances read onchain
- native XTZ transfer execution on Etherlink testnet
- explorer links for submitted transactions
- chain-aware wallet metadata and asset display
- Etherlink-backed confirmation and transaction flow
- an onchain payment intent registry contract deployed on Etherlink testnet

Why Etherlink matters:

- it provides an EVM-compatible environment, which simplifies developer tooling and wallet integration patterns
- it enables low-friction Web3 UX for builders and users
- it supports real onchain execution while remaining practical for hackathon delivery
- it is a strong fit for a conversational wallet experience that still settles actions transparently onchain

## Architecture

ChapChap is split into a frontend, backend, database, blockchain integration layer, and AI orchestration layer.

- Frontend  
  Next.js (App Router), TypeScript, Tailwind CSS  
  Mobile-first interface with dashboard, chat, wallet funding, confirmation, success, and history views.

- Backend  
  Django + Django REST Framework  
  Handles auth, wallet provisioning, conversational agent routing, payment preparation, transaction execution, history persistence, and optional registry writes.

- Database  
  PostgreSQL  
  Stores users, linked auth methods, wallets, encrypted keys, payment intents, transaction history, pending sessions, and demo feature records.

- Blockchain Integration  
  Web3.py + Etherlink RPC  
  Reads balances from Etherlink, submits real native-token transactions on Etherlink testnet, and can record payment intents onchain.

- AI Layer  
  Gemini-backed advice and interpretation services plus deterministic routing logic  
  Used for natural language interpretation, portfolio prompts, and assistant behavior.

## User Flow

1. Sign in with Google.
2. ChapChap automatically creates a wallet for the user.
3. Fund the wallet using the wallet address or testnet funding flow.
4. Type a request in the chat interface.
5. ChapChap interprets the request and asks follow-up questions if needed.
6. ChapChap prepares a confirmation view with the transaction details.
7. After explicit confirmation, the transaction is submitted on Etherlink testnet.

## Working Features

The following features are currently implemented and working:

- Google authentication
- automatic wallet creation per user
- encrypted backend wallet key storage
- wallet address display and copy
- fund wallet information flow
- onchain balance reads for XTZ on Etherlink testnet
- chat-based payment request parsing
- conversational payment clarification flow
- real native XTZ send flow on Etherlink testnet
- transaction confirmation and success UX
- explorer link generation
- PostgreSQL-backed transaction history
- portfolio and investment advice prompts
- product search responses with useful store links
- scheduled payment creation and scheduled history state
- deployed frontend, backend, and smart contract setup

## Demo / Planned Features

Some flows are currently implemented in demo mode or remain partially planned for future improvement:

- swap flow  
  Conversational detection and preview exist, but full live swap execution is not yet integrated.

- save / earn flow  
  Implemented in demo mode with simulated strategy selection and savings position records.

- Bitrefill gift cards  
  Implemented in demo-friendly form with result cards and history support; full API-backed purchase flow is planned.

- advanced scheduled execution  
  Scheduled payments can be created and stored, but production-grade async execution and retry handling are future work.

## Smart Contract

ChapChap includes a lightweight onchain registry contract used to record payment intent metadata on Etherlink testnet.

- Contract Name: `ChapChapPaymentRegistry`
- Contract Address: `0x9f68816F73bCf4A01b73dc75A1f0012AD7362d35`
- Network: `Etherlink Testnet`
- Purpose: `Store ChapChap payment intent records onchain for demo visibility, auditability, and hackathon submission readiness`


## Demo Video

- Demo Video: `https://www.loom.com/share/81ba612a3c364b6b96b501dbf80300a3`

## Repository Structure

At a high level, the repository is organized like this:

- `chapchap-frontend/`  
  Next.js frontend application, chat UI, dashboard, wallet screens, and responsive components.

- `chapchap-backend/`  
  Django backend application, REST API, auth, wallet provisioning, AI orchestration, blockchain integration, and history models.

- `contracts/`  
  Solidity contracts for Etherlink deployment.

- `scripts/`  
  Hardhat deployment and read scripts for the ChapChap contract workspace.

- `chapchap-backend/backend/apps/users/`  
  Custom user model and user-facing profile/dashboard endpoints.

- `chapchap-backend/backend/apps/authn/`  
  Google authentication and linked auth method handling.

- `chapchap-backend/backend/apps/wallets/`  
  Wallet profile creation, encrypted key storage, wallet funding data, and balance snapshots.

- `chapchap-backend/backend/apps/ai_agent/`  
  Chat orchestration, conversational state, intent routing, advice prompts, and assistant behavior.

- `chapchap-backend/backend/apps/payments/`  
  Payment intents, submission flow, history records, scheduled payment support, savings demo, and gift card demo records.

- `chapchap-backend/backend/apps/blockchain/`  
  Etherlink read/write integration, gas helpers, native transfer submission, and payment registry recording.

## Local Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd chapchap
```

### 2. Set up the backend

```bash
cd chapchap-backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create:

```text
chapchap-backend/backend/.env
```

Then run:

```bash
python backend/manage.py migrate
python backend/manage.py runserver
```

### 3. Set up the frontend

Open a new terminal:

```bash
cd chapchap-frontend
npm install
```

Create:

```text
chapchap-frontend/.env.local
```

Then run:

```bash
npm run dev
```

### 4. Optional contract commands

From the repo root:

```bash
npm install
npm run compile:contracts
npm run deploy:etherlink-testnet
npm run read:etherlink-testnet
```

### 5. Open the app

- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:8000`

## Environment Variables

### Backend

Use placeholders like these in `chapchap-backend/backend/.env`:

```env
DJANGO_SETTINGS_MODULE=config.settings.dev
SECRET_KEY=change-me
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost
DATABASE_URL=your-database-url

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_OAUTH_VERIFY_AUDIENCE=True

GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3-flash-preview

WALLET_ENCRYPTION_KEY=your-generated-fernet-key
BALANCE_REFRESH_TTL_SECONDS=20

BLOCKCHAIN_NETWORK=etherlink_testnet
ETHERLINK_TESTNET_RPC_URL=https://your-etherlink-rpc
ETHERLINK_TESTNET_CHAIN_ID=128123
ETHERLINK_TESTNET_EXPLORER_BASE_URL=https://testnet.explorer.etherlink.com
ETHERLINK_TESTNET_SENDER_PRIVATE_KEY=your-funded-testnet-private-key
ETHERLINK_TESTNET_SENDER_ADDRESS=optional-derived-or-explicit-address
ETHERLINK_TESTNET_USDC_ADDRESS=

CHAPCHAP_PAYMENT_REGISTRY_ENABLED=True
CHAPCHAP_PAYMENT_REGISTRY_ADDRESS=0x9f68816F73bCf4A01b73dc75A1f0012AD7362d35
```

### Frontend

Use placeholders like these in `chapchap-frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_ENABLE_DEV_AUTH=false
```

### Database note

- Local development should use your provider's external PostgreSQL URL.
- Render production should use Render's internal PostgreSQL URL.
- The app uses `DATABASE_URL` as the single source of truth, so no code changes are needed between environments.

## Team

Add team details here before submission.

- Name: `TBD`
- Role: `TBD`

- Name: `TBD`
- Role: `TBD`

- Name: `TBD`
- Role: `TBD`

## Future Improvements

- real onchain swap execution
- real savings protocol integration
- full Bitrefill purchase flow
- smarter scheduled transaction execution and retries
- richer portfolio analytics and recommendation quality
- stronger multi-asset support
- production-grade custody and key management architecture
- wallet export and recovery flows

## License

MIT License
