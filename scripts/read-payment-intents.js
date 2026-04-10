const hre = require("hardhat");

async function main() {
  const registryAddress =
    process.env.CHAPCHAP_PAYMENT_REGISTRY_ADDRESS ||
    "0x9f68816F73bCf4A01b73dc75A1f0012AD7362d35";

  const [reader] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt(
    "ChapChapPaymentRegistry",
    registryAddress
  );

  const total = await contract.totalPaymentIntents();
  const myIds = await contract.getMyPaymentIntentIds();

  console.log("Reading ChapChapPaymentRegistry");
  console.log("Network:", hre.network.name);
  console.log("Registry:", registryAddress);
  console.log("Reader:", reader.address);
  console.log("Total payment intents:", total.toString());
  console.log("My payment intent ids:", myIds.map((id) => id.toString()));

  if (total > 0n) {
    const latest = await contract.getPaymentIntent(total);
    console.log("Latest payment intent:");
    console.log({
      id: latest.id.toString(),
      creator: latest.creator,
      recipient: latest.recipient,
      amount: latest.amount.toString(),
      tokenSymbol: latest.tokenSymbol,
      note: latest.note,
      scheduledFor: latest.scheduledFor.toString(),
      createdAt: latest.createdAt.toString(),
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
