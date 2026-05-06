import { formatEther, hexlify, parseEther } from "ethers";
import type { Eip1193Provider, Signer } from "ethers";

const MAX_UINT64 = BigInt("18446744073709551615");
const ZAMA_SEPOLIA_CHAIN_ID = 11155111;
const ZAMA_RELAYER_URL_OVERRIDE = process.env.NEXT_PUBLIC_ZAMA_RELAYER_URL?.trim();

type ZamaInputProofBytes = {
  handles: Uint8Array[];
  inputProof: Uint8Array;
};

type ZamaEncryptedInput = {
  add64: (value: number | bigint) => ZamaEncryptedInput;
  encrypt: () => Promise<ZamaInputProofBytes>;
};

type ZamaHandleContractPair = {
  handle: string;
  contractAddress: string;
};

type ZamaKeypair = {
  publicKey: string;
  privateKey: string;
};

type ZamaUserDecryptEip712 = {
  domain: Record<string, unknown>;
  types: {
    UserDecryptRequestVerification: ReadonlyArray<{
      name: string;
      type: string;
    }>;
  };
  message: Record<string, unknown>;
};

type ZamaInstance = {
  createEncryptedInput: (
    contractAddress: string,
    userAddress: string,
  ) => ZamaEncryptedInput;
  generateKeypair: () => ZamaKeypair;
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: number,
    durationDays: number,
  ) => ZamaUserDecryptEip712;
  userDecrypt: (
    handles: ZamaHandleContractPair[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: number,
    durationDays: number,
  ) => Promise<Record<string, bigint | number | string>>;
};

type ZamaRelayerSdkModule = typeof import("@zama-fhe/relayer-sdk/web");

let sdkModulePromise: Promise<ZamaRelayerSdkModule> | null = null;
let sdkInitPromise: Promise<void> | null = null;
let relayerInstancePromise: Promise<unknown> | null = null;

export type EncryptedAmount64 = {
  encryptedAmount: `0x${string}`;
  inputProof: `0x${string}`;
  amountWei: bigint;
  amountWeiUint64: bigint;
  amountEthDisplay: string;
};

export async function initZamaRelayer(providerOrSigner: unknown) {
  const sdk = await loadRelayerSdk();
  const networkProvider = resolveEip1193Provider(providerOrSigner);
  const providerChainId = await getProviderChainId(networkProvider);
  const sepoliaConfig = ZAMA_RELAYER_URL_OVERRIDE
    ? {
        ...sdk.SepoliaConfig,
        relayerUrl: ZAMA_RELAYER_URL_OVERRIDE,
      }
    : sdk.SepoliaConfig;

  debugLog("Initializing SDK", {
    sdkSource: "@zama-fhe/relayer-sdk/web",
    providerChainId,
    expectedChainId: ZAMA_SEPOLIA_CHAIN_ID,
    relayerUrl: sepoliaConfig.relayerUrl,
    gatewayChainId: sepoliaConfig.gatewayChainId,
    aclContractAddress: sepoliaConfig.aclContractAddress,
    kmsContractAddress: sepoliaConfig.kmsContractAddress,
    inputVerifierContractAddress: sepoliaConfig.inputVerifierContractAddress,
  });

  if (providerChainId !== null && providerChainId !== ZAMA_SEPOLIA_CHAIN_ID) {
    throw new Error("Zama encryption requires a Sepolia wallet connection.");
  }

  if (!sdkInitPromise) {
    sdkInitPromise = sdk
      .initSDK()
      .then(() => {
        debugLog("SDK initialized");
      })
      .catch((error) => {
        console.error("[ChapChap][Zama] SDK init failed", error);
        sdkInitPromise = null;
        throw error;
      });
  }
  await sdkInitPromise;

  if (!relayerInstancePromise) {
    relayerInstancePromise = sdk
      .createInstance({
        ...sepoliaConfig,
        network: networkProvider,
      })
      .then((instance) => {
        debugLog("Relayer instance created", {
          relayerUrl: sepoliaConfig.relayerUrl,
        });
        return instance;
      })
      .catch((error) => {
        console.error("[ChapChap][Zama] Relayer instance creation failed", error);
        relayerInstancePromise = null;
        throw error;
      });
  }

  const relayerInstance = await relayerInstancePromise;
  return relayerInstance as ZamaInstance;
}

export async function encryptAmount64(
  providerOrSigner: unknown,
  contractAddress: string,
  userAddress: string,
  amountInput: string | bigint,
): Promise<EncryptedAmount64> {
  const amountWei = normalizeAmountWei(amountInput);
  const instance = await initZamaRelayer(providerOrSigner);

  debugLog("Encrypting amount", {
    contractAddress,
    userAddress,
    amountWei: amountWei.toString(),
    amountEthDisplay: formatEther(amountWei),
    amountUint64: amountWei.toString(),
  });

  const buffer = instance.createEncryptedInput(contractAddress, userAddress);
  buffer.add64(amountWei);

  let ciphertexts: ZamaInputProofBytes;
  try {
    ciphertexts = await buffer.encrypt();
  } catch (error) {
    console.error("[ChapChap][Zama] Encrypt amount failed", {
      contractAddress,
      userAddress,
      amountWei: amountWei.toString(),
      error,
    });
    throw toUserFacingEncryptionError(error);
  }

  const firstHandle = ciphertexts.handles[0];
  debugLog("Encrypt result", {
    handleCount: ciphertexts.handles.length,
    firstHandleBytes: firstHandle?.length ?? 0,
    inputProofBytes: ciphertexts.inputProof.length,
  });

  if (!firstHandle || ciphertexts.inputProof.length === 0) {
    throw new Error("Zama relayer encryption failed to return a valid handle and proof.");
  }

  return {
    encryptedAmount: hexlify(firstHandle) as `0x${string}`,
    inputProof: hexlify(ciphertexts.inputProof) as `0x${string}`,
    amountWei,
    amountWeiUint64: amountWei,
    amountEthDisplay: formatEther(amountWei),
  };
}

export async function decryptUserBalance() {
  throw new Error("Use decryptHandle64 for wallet-scoped user decryption.");
}

export async function decryptHandle64(
  providerOrSigner: unknown,
  signer: Signer,
  contractAddress: string,
  userAddress: string,
  ciphertextHandle: string,
) {
  if (!ciphertextHandle || isZeroHandle(ciphertextHandle)) {
    return {
      amountWei: BigInt(0),
      amountEthDisplay: "0",
    };
  }

  const instance = await initZamaRelayer(providerOrSigner);
  const keypair = instance.generateKeypair();
  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = 1;
  const contractAddresses = [contractAddress];
  const eip712 = instance.createEIP712(
    keypair.publicKey,
    contractAddresses,
    startTimestamp,
    durationDays,
  );

  debugLog("Decrypting private balance", {
    contractAddress,
    userAddress,
    ciphertextHandle,
    startTimestamp,
    durationDays,
  });

  try {
    const signature = await signer.signTypedData(
      eip712.domain,
      {
        UserDecryptRequestVerification:
          eip712.types.UserDecryptRequestVerification as Array<{
            name: string;
            type: string;
          }>,
      },
      eip712.message,
    );

    const result = await instance.userDecrypt(
      [{ handle: ciphertextHandle, contractAddress }],
      keypair.privateKey,
      keypair.publicKey,
      signature.replace(/^0x/, ""),
      contractAddresses,
      userAddress,
      startTimestamp,
      durationDays,
    );

    const decryptedValue =
      result[ciphertextHandle] ??
      result[ciphertextHandle.toLowerCase()] ??
      result[ciphertextHandle.toUpperCase()];

    if (decryptedValue === undefined || decryptedValue === null) {
      throw new Error("Zama relayer decryption did not return a private balance value.");
    }

    const amountWei = BigInt(decryptedValue);
    debugLog("Decrypt result", {
      ciphertextHandle,
      amountWei: amountWei.toString(),
      amountEthDisplay: formatEther(amountWei),
    });

    return {
      amountWei,
      amountEthDisplay: formatEther(amountWei),
    };
  } catch (error) {
    console.error("[ChapChap][Zama] Private balance decryption failed", {
      contractAddress,
      userAddress,
      ciphertextHandle,
      error,
    });
    throw toUserFacingDecryptionError(error);
  }
}

export function toUint64Wei(amountEth: string) {
  return normalizeAmountWei(amountEth);
}

async function loadRelayerSdk() {
  if (typeof window === "undefined") {
    throw new Error("Zama encryption is only available in the browser.");
  }

  if (!sdkModulePromise) {
    sdkModulePromise = import("@zama-fhe/relayer-sdk/web")
      .then((sdkModule) => {
        debugLog("Loaded SDK module", {
          sdkSource: "@zama-fhe/relayer-sdk/web",
          relayerUrl: sdkModule.SepoliaConfig.relayerUrl,
          chainId: sdkModule.SepoliaConfig.chainId,
          gatewayChainId: sdkModule.SepoliaConfig.gatewayChainId,
        });
        return sdkModule;
      })
      .catch((error) => {
        console.error("[ChapChap][Zama] SDK module import failed", error);
        sdkModulePromise = null;
        throw new Error("The Zama Relayer SDK could not be loaded in this browser.");
      });
  }

  const sdkModule = await sdkModulePromise;
  return sdkModule;
}

function resolveEip1193Provider(providerOrSigner: unknown): Eip1193Provider {
  if (
    providerOrSigner &&
    typeof providerOrSigner === "object" &&
    "request" in providerOrSigner &&
    typeof providerOrSigner.request === "function"
  ) {
    return providerOrSigner as Eip1193Provider;
  }

  if (
    providerOrSigner &&
    typeof providerOrSigner === "object" &&
    "provider" in providerOrSigner &&
    providerOrSigner.provider &&
    typeof providerOrSigner.provider === "object" &&
    "request" in providerOrSigner.provider &&
    typeof providerOrSigner.provider.request === "function"
  ) {
    return providerOrSigner.provider as Eip1193Provider;
  }

  throw new Error("Zama relayer needs an EIP-1193 wallet provider.");
}

function normalizeAmountWei(amountInput: string | bigint) {
  const amountWei =
    typeof amountInput === "bigint" ? amountInput : safeParseEther(amountInput);

  if (amountWei <= BigInt(0)) {
    throw new Error("Amount must be greater than zero.");
  }

  if (amountWei > MAX_UINT64) {
    throw new Error(
      "This amount is too large for the current uint64 confidential contract. Use a smaller Sepolia ETH amount.",
    );
  }

  return amountWei;
}

function safeParseEther(amountEth: string) {
  try {
    return parseEther(amountEth.trim());
  } catch {
    throw new Error("Enter a valid ETH amount, for example 0.0001 ETH.");
  }
}

async function getProviderChainId(provider: Eip1193Provider) {
  try {
    const chainIdHex = await provider.request({ method: "eth_chainId" });
    if (typeof chainIdHex !== "string") {
      return null;
    }
    return Number(chainIdHex);
  } catch (error) {
    console.warn("[ChapChap][Zama] Unable to read provider chain id", error);
    return null;
  }
}

function toUserFacingEncryptionError(error: unknown) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const lowered = message.toLowerCase();

  if (lowered.includes("404") || lowered.includes("not found")) {
    return new Error(
      "Zama relayer encryption failed with a 404 response. Check the Sepolia relayer configuration and try again.",
    );
  }

  if (lowered.includes("network") || lowered.includes("fetch")) {
    return new Error(
      "Zama relayer encryption could not reach the Sepolia relayer. Check your network connection and try again.",
    );
  }

  return new Error(
    message || "Zama relayer encryption failed before the confidential transaction could be sent.",
  );
}

function debugLog(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.info(`[ChapChap][Zama] ${message}`, details);
    return;
  }
  console.info(`[ChapChap][Zama] ${message}`);
}

function toUserFacingDecryptionError(error: unknown) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const lowered = message.toLowerCase();

  if (lowered.includes("user rejected")) {
    return new Error("Wallet confirmation was rejected while decrypting your private balance.");
  }

  if (lowered.includes("not authorized") || lowered.includes("not allowed")) {
    return new Error("Only the connected wallet owner can decrypt this ChapChap balance.");
  }

  if (lowered.includes("404") || lowered.includes("not found")) {
    return new Error("Zama relayer decryption failed with a 404 response.");
  }

  return new Error(
    message || "Private balance decryption could not be completed right now.",
  );
}

function isZeroHandle(handle: string) {
  return /^0x0+$/i.test(handle);
}
