require("@fhevm/hardhat-plugin");
require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL || "";
const sepoliaPrivateKey = process.env.SEPOLIA_PRIVATE_KEY || "";

/** @type import("hardhat/config").HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia: {
      url: sepoliaRpcUrl,
      accounts: sepoliaPrivateKey ? [sepoliaPrivateKey] : [],
      chainId: 11155111,
    },
  },
};
