const hre = require("hardhat");

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const privateKey = process.env.SEPOLIA_PRIVATE_KEY;

  if (!rpcUrl) {
    throw new Error("Missing SEPOLIA_RPC_URL in contracts-zama/.env.");
  }

  if (!privateKey) {
    throw new Error("Missing SEPOLIA_PRIVATE_KEY in contracts-zama/.env.");
  }

  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("Deploying ChapChapConfidentialCore");
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");

  const factory = await hre.ethers.getContractFactory("ChapChapConfidentialCore");
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
