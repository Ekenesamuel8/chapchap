const hre = require("hardhat");

async function main() {
  const rpcUrl =
    process.env.WALLET_TESTNET_RPC_URL ||
    process.env.ETHERLINK_TESTNET_RPC_URL;
  const privateKeyConfigured = Boolean(
    process.env.TESTNET_WALLET_PRIVATE_KEY ||
      process.env.ETHERLINK_TESTNET_SENDER_PRIVATE_KEY
  );

  if (!rpcUrl) {
    throw new Error(
      "Missing WALLET_TESTNET_RPC_URL or ETHERLINK_TESTNET_RPC_URL in your env."
    );
  }

  if (!privateKeyConfigured) {
    throw new Error(
      "Missing TESTNET_WALLET_PRIVATE_KEY or ETHERLINK_TESTNET_SENDER_PRIVATE_KEY in your env."
    );
  }

  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("Deploying ChapChapPaymentRegistry");
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "XTZ");

  const factory = await hre.ethers.getContractFactory("ChapChapPaymentRegistry");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("Contract deployed successfully.");
  console.log("Contract address:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
