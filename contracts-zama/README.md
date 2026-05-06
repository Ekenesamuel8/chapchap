# ChapChap Confidential Contracts

Minimal Zama FHEVM Sepolia workspace for `ChapChap Confidential`.

## Setup

1. Install dependencies

```bash
cd contracts-zama
npm install
```

2. Create `.env`

Copy `.env.example` to `.env` and fill in:

```env
SEPOLIA_RPC_URL=...
SEPOLIA_PRIVATE_KEY=...
```

3. Compile

```bash
npm run compile
```

4. Deploy to Sepolia

```bash
npm run deploy:sepolia
```

## Contract

- `ChapChapConfidentialCore.sol`
  - public ETH deposits
  - encrypted internal balances
  - confidential transfers
  - confidential savings bucket

## Notes

- This is an MVP foundation, not a production treasury contract.
- Deposit amounts are public because ETH transfer value is public onchain.
- Internal balance references and confidential transfer inputs are structured for Zama FHEVM types.
