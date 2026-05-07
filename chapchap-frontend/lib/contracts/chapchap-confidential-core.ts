import { CHAPCHAP_CONFIDENTIAL_CORE_ABI } from "./chapchap-confidential-core-abi";

export { CHAPCHAP_CONFIDENTIAL_CORE_ABI };

export const ZAMA_SEPOLIA_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_ZAMA_CHAIN_ID ?? "11155111",
);

export const ZAMA_EXPLORER_BASE_URL =
  process.env.NEXT_PUBLIC_ZAMA_EXPLORER_BASE_URL ?? "https://sepolia.etherscan.io";

export const CHAPCHAP_CONFIDENTIAL_CORE_ADDRESS =
  process.env.NEXT_PUBLIC_ZAMA_CORE_CONTRACT_ADDRESS ?? "";

export function getTxExplorerUrl(txHash: string) {
  return `${ZAMA_EXPLORER_BASE_URL.replace(/\/$/, "")}/tx/${txHash}`;
}

export function getAddressExplorerUrl(address: string) {
  return `${ZAMA_EXPLORER_BASE_URL.replace(/\/$/, "")}/address/${address}`;
}
