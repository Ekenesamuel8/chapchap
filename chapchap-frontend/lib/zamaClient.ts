import { formatEther, hexlify, parseEther } from "ethers";
import type { Eip1193Provider, Signer } from "ethers";

const MAX_UINT64 = BigInt("18446744073709551615");
const ZAMA_SEPOLIA_CHAIN_ID = 11155111;
const RAW_ZAMA_RELAYER_URL_OVERRIDE = process.env.NEXT_PUBLIC_ZAMA_RELAYER_URL?.trim();
const IGNORED_LEGACY_ZAMA_RELAYER_URL =
  RAW_ZAMA_RELAYER_URL_OVERRIDE?.includes("relayer.testnet.zama.cloud") ?? false;
const ZAMA_RELAYER_URL_OVERRIDE = IGNORED_LEGACY_ZAMA_RELAYER_URL
  ? undefined
  : RAW_ZAMA_RELAYER_URL_OVERRIDE;
const REQUESTED_ZAMA_SDK_SOURCE =
  process.env.NEXT_PUBLIC_ZAMA_SDK_SOURCE?.trim().toLowerCase() ?? "package";
const HAS_EXPLICIT_ZAMA_SDK_CDN_URL = Boolean(
  process.env.NEXT_PUBLIC_ZAMA_SDK_CDN_URL?.trim(),
);
const ZAMA_SDK_SOURCE =
  REQUESTED_ZAMA_SDK_SOURCE === "cdn" && HAS_EXPLICIT_ZAMA_SDK_CDN_URL
    ? "cdn"
    : "package";
const IGNORED_CDN_SOURCE_WITHOUT_URL =
  REQUESTED_ZAMA_SDK_SOURCE === "cdn" && !HAS_EXPLICIT_ZAMA_SDK_CDN_URL;
const ZAMA_SDK_CDN_URL =
  process.env.NEXT_PUBLIC_ZAMA_SDK_CDN_URL?.trim() ||
  "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.js";
const RELAYER_OPERATION_TIMEOUT_MS = 25_000;
const RELAYER_RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;

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

type ZamaRelayerSdkModule = {
  initSDK: () => Promise<void>;
  createInstance: (config: Record<string, unknown>) => Promise<unknown>;
  SepoliaConfig: Record<string, unknown>;
  __chapchapSource?: "cdn" | "package";
};

export type ZamaEncryptionStage =
  | "preparing"
  | "connecting"
  | "encrypting"
  | "retrying"
  | "ready";

export type ZamaEncryptionProgress = {
  stage: ZamaEncryptionStage;
  attempt: number;
  maxRetries: number;
  message: string;
};

type ZamaEncryptionOptions = {
  onProgress?: (progress: ZamaEncryptionProgress) => void;
};

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

export async function initZamaRelayer(
  providerOrSigner: unknown,
  options: ZamaEncryptionOptions = {},
) {
  options.onProgress?.({
    stage: "preparing",
    attempt: 1,
    maxRetries: RELAYER_RETRY_DELAYS_MS.length,
    message: "Preparing Zama encryption...",
  });
  const sdk = await loadRelayerSdk();
  const networkProvider = resolveEip1193Provider(providerOrSigner);
  const providerChainId = await getProviderChainId(networkProvider);
  const sepoliaConfig = ZAMA_RELAYER_URL_OVERRIDE
    ? {
        ...sdk.SepoliaConfig,
        relayerUrl: ZAMA_RELAYER_URL_OVERRIDE,
      }
    : sdk.SepoliaConfig;

  if (IGNORED_LEGACY_ZAMA_RELAYER_URL) {
    console.warn("[ChapChap][Zama] Ignoring stale relayer override", {
      configuredRelayerUrl: RAW_ZAMA_RELAYER_URL_OVERRIDE,
      sdkRelayerUrl: sepoliaConfig.relayerUrl,
    });
  }

  debugLog("Initializing SDK", {
    sdkSource: sdk.__chapchapSource ?? "unknown",
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

  options.onProgress?.({
    stage: "connecting",
    attempt: 1,
    maxRetries: RELAYER_RETRY_DELAYS_MS.length,
    message: "Connecting to Zama Sepolia relayer...",
  });

  if (!sdkInitPromise) {
    sdkInitPromise = withRelayerRetries(
      () => withTimeout(sdk.initSDK(), RELAYER_OPERATION_TIMEOUT_MS, "Zama SDK initialization timed out."),
      "SDK init",
      options.onProgress,
    )
      .then(() => {
        debugLog("SDK initialized");
      })
      .catch((error) => {
        console.error("[ChapChap][Zama] SDK init failed", error);
        sdkInitPromise = null;
        throw error;
      });
  } else {
    debugLog("Reusing cached SDK initialization");
  }
  await sdkInitPromise;

  if (!relayerInstancePromise) {
    relayerInstancePromise = withRelayerRetries(
      () =>
        withTimeout(
          sdk.createInstance({
            ...sepoliaConfig,
            network: networkProvider,
          }),
          RELAYER_OPERATION_TIMEOUT_MS,
          "Zama relayer instance creation timed out.",
        ),
      "Relayer instance",
      options.onProgress,
    )
      .then((instance) => {
        debugLog("Relayer instance created", {
          sdkSource: sdk.__chapchapSource ?? "unknown",
          relayerUrl: sepoliaConfig.relayerUrl,
          chainId: sepoliaConfig.chainId,
          gatewayChainId: sepoliaConfig.gatewayChainId,
        });
        return instance;
      })
      .catch((error) => {
        console.error("[ChapChap][Zama] Relayer instance creation failed", error);
        relayerInstancePromise = null;
        throw error;
      });
  } else {
    debugLog("Reusing cached relayer instance", {
      relayerUrl: sepoliaConfig.relayerUrl,
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
  options: ZamaEncryptionOptions = {},
): Promise<EncryptedAmount64> {
  options.onProgress?.({
    stage: "preparing",
    attempt: 1,
    maxRetries: RELAYER_RETRY_DELAYS_MS.length,
    message: "Preparing Zama encryption...",
  });
  const amountWei = normalizeAmountWei(amountInput);
  const instance = await initZamaRelayer(providerOrSigner, options);

  debugLog("Encrypting amount", {
    contractAddress,
    userAddress,
    amountWei: amountWei.toString(),
    amountEthDisplay: formatEther(amountWei),
    amountUint64: amountWei.toString(),
  });

  let ciphertexts: ZamaInputProofBytes;
  try {
    options.onProgress?.({
      stage: "encrypting",
      attempt: 1,
      maxRetries: RELAYER_RETRY_DELAYS_MS.length,
      message: "Encrypting amount locally...",
    });
    ciphertexts = await withRelayerRetries(
      async () => {
        const buffer = await withTimeout(
          Promise.resolve(instance.createEncryptedInput(contractAddress, userAddress)),
          RELAYER_OPERATION_TIMEOUT_MS,
          "Zama encrypted input buffer creation timed out.",
        );
        buffer.add64(amountWei);
        return withTimeout(
          buffer.encrypt(),
          RELAYER_OPERATION_TIMEOUT_MS,
          "Zama encrypted input generation timed out.",
        );
      },
      "Encrypted input",
      options.onProgress,
    );
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

  options.onProgress?.({
    stage: "ready",
    attempt: 1,
    maxRetries: RELAYER_RETRY_DELAYS_MS.length,
    message: "Encryption ready. Confirm in wallet.",
  });

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
    sdkModulePromise = loadRelayerSdkByPreference().catch((error) => {
      console.error("[ChapChap][Zama] SDK module import failed", error);
      sdkModulePromise = null;
      throw new Error("The Zama Relayer SDK could not be loaded in this browser.");
    });
  }

  const sdkModule = await sdkModulePromise;
  return sdkModule;
}

async function loadRelayerSdkByPreference(): Promise<ZamaRelayerSdkModule> {
  debugLog("Resolving SDK module", {
    requestedSource: REQUESTED_ZAMA_SDK_SOURCE,
    sourcePreference: ZAMA_SDK_SOURCE,
    hasExplicitCdnUrl: HAS_EXPLICIT_ZAMA_SDK_CDN_URL,
    cdnUrl: HAS_EXPLICIT_ZAMA_SDK_CDN_URL ? ZAMA_SDK_CDN_URL : "not configured",
  });

  if (IGNORED_CDN_SOURCE_WITHOUT_URL) {
    console.warn("[ChapChap][Zama] Ignoring CDN SDK preference without explicit CDN URL", {
      fallbackSource: "package",
    });
  }

  if (ZAMA_SDK_SOURCE === "cdn") {
    return loadRelayerSdkFromCdn().catch((cdnError) => {
      console.warn("[ChapChap][Zama] CDN SDK load failed, falling back to package", {
        cdnUrl: ZAMA_SDK_CDN_URL,
        error: cdnError,
      });
      return loadRelayerSdkFromPackage();
    });
  }

  return loadRelayerSdkFromPackage().catch((packageError) => {
    if (!HAS_EXPLICIT_ZAMA_SDK_CDN_URL) {
      throw packageError;
    }

    console.warn("[ChapChap][Zama] Package SDK load failed, trying configured CDN", {
      cdnUrl: ZAMA_SDK_CDN_URL,
      error: packageError,
    });
    return loadRelayerSdkFromCdn();
  });
}

async function loadRelayerSdkFromCdn(): Promise<ZamaRelayerSdkModule> {
  debugLog("Loading SDK module from CDN", {
    cdnUrl: ZAMA_SDK_CDN_URL,
  });
  const dynamicImport = new Function(
    "url",
    "return import(/* webpackIgnore: true */ url)",
  ) as (url: string) => Promise<ZamaRelayerSdkModule>;
  const sdkModule = await withTimeout(
    dynamicImport(ZAMA_SDK_CDN_URL),
    RELAYER_OPERATION_TIMEOUT_MS,
    "Zama SDK CDN loading timed out.",
  );
  const normalized = normalizeSdkModule(sdkModule, "cdn");
  debugLog("Loaded SDK module", {
    sdkSource: "cdn",
    cdnUrl: ZAMA_SDK_CDN_URL,
    relayerUrl: normalized.SepoliaConfig.relayerUrl,
    chainId: normalized.SepoliaConfig.chainId,
    gatewayChainId: normalized.SepoliaConfig.gatewayChainId,
  });
  return normalized;
}

async function loadRelayerSdkFromPackage(): Promise<ZamaRelayerSdkModule> {
  const sdkModule = await import("@zama-fhe/relayer-sdk/web");
  const normalized = normalizeSdkModule(sdkModule, "package");
  debugLog("Loaded SDK module", {
    sdkSource: "@zama-fhe/relayer-sdk/web",
    relayerUrl: normalized.SepoliaConfig.relayerUrl,
    chainId: normalized.SepoliaConfig.chainId,
    gatewayChainId: normalized.SepoliaConfig.gatewayChainId,
  });
  return normalized;
}

function normalizeSdkModule(
  sdkModule: unknown,
  source: "cdn" | "package",
): ZamaRelayerSdkModule {
  if (!sdkModule || typeof sdkModule !== "object") {
    throw new Error("Zama SDK module did not load as an object.");
  }
  const initSDK = Reflect.get(sdkModule, "initSDK");
  const createInstance = Reflect.get(sdkModule, "createInstance");
  const SepoliaConfig = Reflect.get(sdkModule, "SepoliaConfig");

  if (
    typeof initSDK !== "function" ||
    typeof createInstance !== "function" ||
    !SepoliaConfig ||
    typeof SepoliaConfig !== "object"
  ) {
    throw new Error("Zama SDK module is missing initSDK, createInstance, or SepoliaConfig.");
  }

  return {
    initSDK: initSDK as ZamaRelayerSdkModule["initSDK"],
    createInstance: createInstance as ZamaRelayerSdkModule["createInstance"],
    SepoliaConfig: SepoliaConfig as Record<string, unknown>,
    __chapchapSource: source,
  };
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
      "Zama Sepolia relayer is temporarily unreachable. Funds were not moved.",
    );
  }

  if (
    lowered.includes("network") ||
    lowered.includes("fetch") ||
    lowered.includes("timeout") ||
    lowered.includes("timed out") ||
    lowered.includes("relayer")
  ) {
    return new Error(
      "Zama Sepolia relayer is temporarily unreachable. Funds were not moved.",
    );
  }

  return new Error(
    message || "Zama relayer encryption failed before the confidential transaction could be sent.",
  );
}

async function withRelayerRetries<T>(
  operation: () => Promise<T>,
  label: string,
  onProgress?: (progress: ZamaEncryptionProgress) => void,
): Promise<T> {
  const maxRetries = RELAYER_RETRY_DELAYS_MS.length;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    try {
      debugLog(`${label} attempt`, {
        attempt,
        maxAttempts: maxRetries + 1,
        timeoutMs: RELAYER_OPERATION_TIMEOUT_MS,
      });
      return await operation();
    } catch (error) {
      const retryNumber = attempt;
      const shouldRetry = attempt <= maxRetries && isRetryableRelayerError(error);
      console.warn(`[ChapChap][Zama] ${label} attempt failed`, {
        failingStep: label,
        attempt,
        maxAttempts: maxRetries + 1,
        retrying: shouldRetry,
        error,
      });

      if (!shouldRetry) {
        throw error;
      }

      onProgress?.({
        stage: "retrying",
        attempt: retryNumber,
        maxRetries,
        message: `Retrying relayer connection (${retryNumber}/${maxRetries})...`,
      });
      await delay(RELAYER_RETRY_DELAYS_MS[attempt - 1]);
    }
  }

  throw new Error("Zama relayer operation failed after retries.");
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer));
  });
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isRetryableRelayerError(error: unknown) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const lowered = message.toLowerCase();
  return (
    lowered.includes("404") ||
    lowered.includes("not found") ||
    lowered.includes("network") ||
    lowered.includes("fetch") ||
    lowered.includes("timeout") ||
    lowered.includes("timed out") ||
    lowered.includes("relayer") ||
    lowered.includes("failed to fetch")
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
