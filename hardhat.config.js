require("@nomicfoundation/hardhat-ethers");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "chapchap-backend", "backend", ".env") });
dotenv.config({ path: path.join(__dirname, ".env") });

const rpcUrl =
  process.env.WALLET_TESTNET_RPC_URL ||
  process.env.ETHERLINK_TESTNET_RPC_URL ||
  "";
const privateKey =
  process.env.TESTNET_WALLET_PRIVATE_KEY ||
  process.env.ETHERLINK_TESTNET_SENDER_PRIVATE_KEY ||
  "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    etherlinkTestnet: {
      url: rpcUrl,
      accounts: privateKey ? [privateKey] : [],
      chainId: 127823
    }
  }
};
