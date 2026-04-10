# ChapChap

ChapChap is an AI-powered wallet assistant built for Tezos EVM on Etherlink. It helps users interact with crypto through natural language instead of complex wallet interfaces, making common Web3 actions like funding a wallet, sending assets, reviewing transactions, and exploring related product flows feel more approachable for everyday users. The project combines conversational AI, a mobile-first frontend, and real Etherlink testnet integration to create a beginner-friendly onchain experience.

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

- Natural language intent parsing  
  Users can describe payment requests in plain English, and the assistant interprets the intent, amount, asset, timing, and recipient context.

- Conversational follow-up flow  
  If a request is incomplete, ChapChap asks for the missing information instead of failing or forcing the user into a separate form.

- Portfolio and investment prompts  
  Users can ask questions like “How do I invest?” or “Analyze my portfolio and suggest investment,” and ChapChap responds with guidance informed by wallet context where available.

- Shopping and product search assistance  
  ChapChap can help users explore product-related prompts by returning practical shopping links and conversational suggestions.

- Guided UX instead of generic chat  
  The assistant is designed to move users toward clear, reviewable actions rather than produce open-ended conversation with no execution path.

To keep the system efficient and resilient, the app also uses deterministic logic where possible and relies on LLM calls only when they add real value.

## Etherlink / Tezos EVM Integration

ChapChap is built around Etherlink testnet as its live blockchain environment.

Current Etherlink integration includes:

- wallet balances read onchain
- native XTZ transfer execution on Etherlink testnet
- explorer links for submitted transactions
- chain-aware wallet metadata and asset display
- Etherlink-backed confirmation and transaction flow

Why Etherlink matters:

- it provides an EVM-compatible environment, which simplifies developer tooling and wallet integration patterns
- it aligns with a low-friction path for building familiar Web3 flows
- it enables real onchain execution while supporting a hackathon-friendly development cycle
- it is a strong fit for building a conversational wallet UX that still settles actions transparently onchain

The project is already structured to support a future smart contract and protocol integration layer, and a dedicated contract section is included below for that purpose.

## Architecture

ChapChap is split into a frontend, backend, database, blockchain integration layer, and AI orchestration layer.

- Frontend  
  Next.js (App Router), TypeScript, Tailwind CSS  
  Mobile-first interface with dashboard, chat, wallet funding, confirmation, success, and history views.

- Backend  
  Django + Django REST Framework  
  Handles auth, wallet provisioning, conversational agent routing, payment preparation, transaction execution, and history persistence.

- Database  
  PostgreSQL  
  Stores users, linked auth methods, wallets, encrypted keys, payment intents, transaction history, pending sessions, and demo feature records.

- Blockchain Integration  
  Web3.py + Etherlink RPC  
  Reads balances from Etherlink and submits real native-token transactions on Etherlink testnet.

- AI Layer  
  Gemini-backed intent/advice services plus deterministic routing logic  
  Used for natural language interpretation, conversational assistance, investment/portfolio responses, and smart fallback behavior.

## User Flow

1. The user signs in with Google.
2. ChapChap automatically creates a wallet for the user.
3. The user funds the wallet using the wallet address or testnet funding flow.
4. The user types a request in the chat interface.
5. ChapChap interprets the request and asks follow-up questions if needed.
6. ChapChap prepares a confirmation view with the transaction details.
7. After explicit confirmation, the transaction is submitted on Etherlink testnet.

## Working Features

The following features are currently implemented and working in the project:

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
- portfolio/investment advice prompts
- product search responses with useful store links
- scheduled payment creation and scheduled history state
- deployed frontend and backend structure

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

This section is reserved for contract details if/when a dedicated onchain contract is deployed.

- Contract Name: `TBD`
- Contract Address: `TBD`
- Network: `Etherlink Testnet / Etherlink Mainnet`
- Purpose: `TBD`

## Screenshots

Add screenshots here before submission.

- Landing / onboarding screen
- Dashboard / wallet overview
- AI payment confirmation flow
- Successful transaction state
- History page
- Fund wallet flow

## Demo Video

Add demo video link here before submission.

- Demo Video: https://www.loom.com/share/81ba612a3c364b6b96b501dbf80300a3

## Repository Structure

At a high level, the repository is organized like this:

- `chapchap-frontend/`  
  Next.js frontend application, chat UI, dashboard, wallet screens, and responsive components.

- `chapchap-backend/`  
  Django backend application, REST API, auth, wallet provisioning, AI orchestration, blockchain integration, and history models.

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
  Etherlink read/write integration, gas helpers, and transaction submission service.

## Local Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd chapchap


cd chapchap-backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

backend/.env


python backend/manage.py migrate


python backend/manage.py runserver


cd chapchap-frontend
npm install


Configure frontend environment variables
Create:
.env.local

Start the frontend
npm run dev

Open the app
Frontend: http://localhost:3000

Backend: http://127.0.0.1:8000

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

NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_ENABLE_DEV_AUTH=false


video: https://www.loom.com/share/81ba612a3c364b6b96b501dbf80300a3
