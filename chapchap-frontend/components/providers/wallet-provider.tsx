"use client";

import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { BrowserProvider, Contract, formatEther } from "ethers";
import type { Signer } from "ethers";
import { useAuth } from "@/components/providers/auth-provider";
import {
  setStoredWalletConnectionPreference,
} from "@/lib/auth-storage";
import {
  CHAPCHAP_CONFIDENTIAL_CORE_ABI,
  CHAPCHAP_CONFIDENTIAL_CORE_ADDRESS,
  ZAMA_SEPOLIA_CHAIN_ID,
} from "@/lib/contracts/chapchap-confidential-core";
import { decryptHandle64 } from "@/lib/zamaClient";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, listener: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
    };
  }
}

type PrivateBalanceStatus =
  | "idle"
  | "loading"
  | "available"
  | "empty"
  | "decrypting"
  | "revealed"
  | "error";

type WalletContextValue = {
  connectedAddress: string | null;
  walletBalanceEth: string | null;
  isWalletConnecting: boolean;
  privateBalanceStatus: PrivateBalanceStatus;
  privateBalanceEth: string | null;
  privateBalanceHandle: string | null;
  privateBalanceError: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshWalletState: (requestAccounts?: boolean) => Promise<void>;
  revealPrivateBalance: () => Promise<void>;
  getContract: () => Promise<{
    provider: BrowserProvider;
    signer: Signer;
    signerAddress: string;
    contract: Contract;
  }>;
  getSignerClient: () => Promise<{
    provider: BrowserProvider;
    signer: Signer;
    signerAddress: string;
  }>;
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: PropsWithChildren) {
  const { isAuthenticated, hydrated } = useAuth();
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [walletBalanceEth, setWalletBalanceEth] = useState<string | null>(null);
  const [isWalletConnecting, setWalletConnecting] = useState(false);
  const [privateBalanceStatus, setPrivateBalanceStatus] =
    useState<PrivateBalanceStatus>("idle");
  const [privateBalanceEth, setPrivateBalanceEth] = useState<string | null>(null);
  const [privateBalanceHandle, setPrivateBalanceHandle] = useState<string | null>(null);
  const [privateBalanceError, setPrivateBalanceError] = useState<string | null>(null);
  const [walletEnabled, setWalletEnabled] = useState(false);

  const resetWalletState = useCallback(() => {
    setConnectedAddress(null);
    setWalletBalanceEth(null);
    setPrivateBalanceStatus("idle");
    setPrivateBalanceEth(null);
    setPrivateBalanceHandle(null);
    setPrivateBalanceError(null);
  }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      setStoredWalletConnectionPreference(false);
      setWalletEnabled(false);
      resetWalletState();
    }
  }, [hydrated, isAuthenticated, resetWalletState]);

  const switchToSepolia = useCallback(async () => {
    const ethereum = window.ethereum;
    if (!ethereum) {
      throw new Error("MetaMask wasn't detected in this browser.");
    }

    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }],
    });
  }, []);

  const getSignerClient = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("MetaMask wasn't detected in this browser.");
    }

    await switchToSepolia();
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    return { provider, signer, signerAddress };
  }, [switchToSepolia]);

  const getContract = useCallback(async () => {
    if (!CHAPCHAP_CONFIDENTIAL_CORE_ADDRESS) {
      throw new Error(
        "NEXT_PUBLIC_ZAMA_CORE_CONTRACT_ADDRESS is missing. Add the deployed Sepolia contract address first.",
      );
    }

    const { provider, signer, signerAddress } = await getSignerClient();
    const contract = new Contract(
      CHAPCHAP_CONFIDENTIAL_CORE_ADDRESS,
      CHAPCHAP_CONFIDENTIAL_CORE_ABI,
      signer,
    );
    return { provider, signer, signerAddress, contract };
  }, [getSignerClient]);

  const refreshPrivateBalanceStatus = useCallback(async () => {
    if (!connectedAddress || !CHAPCHAP_CONFIDENTIAL_CORE_ADDRESS) {
      setPrivateBalanceStatus("idle");
      setPrivateBalanceHandle(null);
      setPrivateBalanceEth(null);
      setPrivateBalanceError(null);
      return;
    }

    try {
      setPrivateBalanceStatus("loading");
      setPrivateBalanceError(null);
      const { contract } = await getContract();
      const handle = String(await contract.getEncryptedBalance());
      setPrivateBalanceHandle(handle);
      setPrivateBalanceEth(null);

      if (!handle || /^0x0+$/i.test(handle)) {
        setPrivateBalanceStatus("empty");
        return;
      }

      setPrivateBalanceStatus("available");
    } catch (error) {
      setPrivateBalanceStatus("error");
      setPrivateBalanceError(
        error instanceof Error
          ? error.message
          : "Private balance status could not be loaded.",
      );
    }
  }, [connectedAddress, getContract]);

  const refreshWalletState = useCallback(
    async (requestAccounts = false) => {
      const ethereum = window.ethereum;
      if (!ethereum) {
        resetWalletState();
        return;
      }

      try {
        const provider = new BrowserProvider(ethereum);
        if (requestAccounts) {
          await ethereum.request({ method: "eth_requestAccounts" });
        }

        const chainId = Number(await ethereum.request({ method: "eth_chainId" }));
        if (chainId !== ZAMA_SEPOLIA_CHAIN_ID) {
          resetWalletState();
          return;
        }

        const accounts = (await ethereum.request({
          method: "eth_accounts",
        })) as string[];

        if (!Array.isArray(accounts) || accounts.length === 0) {
          resetWalletState();
          return;
        }

        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const balance = await provider.getBalance(address);
        setConnectedAddress(address);
        setWalletBalanceEth(formatWalletBalance(balance));
      } catch {
        resetWalletState();
      }
    },
    [resetWalletState],
  );

  useEffect(() => {
    if (!connectedAddress || !walletEnabled) return;
    void refreshPrivateBalanceStatus();
  }, [connectedAddress, refreshPrivateBalanceStatus, walletEnabled]);

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum?.on || !ethereum.removeListener) return;

    const handleAccountsChanged = () => {
      if (!walletEnabled) return;
      void refreshWalletState();
    };

    const handleChainChanged = () => {
      if (!walletEnabled) return;
      void refreshWalletState();
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [refreshWalletState, walletEnabled]);

  const connectWallet = useCallback(async () => {
    const ethereum = window.ethereum;
    if (!ethereum) {
      throw new Error("MetaMask wasn't detected in this browser.");
    }

    setWalletConnecting(true);
    try {
      await ethereum.request({ method: "eth_requestAccounts" });
      await switchToSepolia();
      setStoredWalletConnectionPreference(true);
      setWalletEnabled(true);
      await refreshWalletState(true);
    } finally {
      setWalletConnecting(false);
    }
  }, [refreshWalletState, switchToSepolia]);

  const disconnectWallet = useCallback(() => {
    setStoredWalletConnectionPreference(false);
    setWalletEnabled(false);
    resetWalletState();
  }, [resetWalletState]);

  const revealPrivateBalance = useCallback(async () => {
    if (!connectedAddress) {
      throw new Error("Connect MetaMask on Sepolia before revealing a private balance.");
    }
    if (!CHAPCHAP_CONFIDENTIAL_CORE_ADDRESS) {
      throw new Error(
        "NEXT_PUBLIC_ZAMA_CORE_CONTRACT_ADDRESS is missing. Add the deployed Sepolia contract address first.",
      );
    }

    const { signer, signerAddress, contract } = await getContract();
    const handle = String(await contract.getEncryptedBalance());
    setPrivateBalanceHandle(handle);

    if (!handle || /^0x0+$/i.test(handle)) {
      setPrivateBalanceStatus("empty");
      setPrivateBalanceEth(null);
      setPrivateBalanceError(null);
      return;
    }

    setPrivateBalanceStatus("decrypting");
    setPrivateBalanceError(null);

    try {
      const result = await decryptHandle64(
        window.ethereum,
        signer,
        CHAPCHAP_CONFIDENTIAL_CORE_ADDRESS,
        signerAddress,
        handle,
      );
      setPrivateBalanceEth(formatBalanceDisplay(result.amountEthDisplay));
      setPrivateBalanceStatus("revealed");
    } catch (error) {
      setPrivateBalanceStatus("available");
      setPrivateBalanceEth(null);
      setPrivateBalanceError(
        error instanceof Error
          ? error.message
          : "Private balance decryption could not be completed right now.",
      );
      throw error;
    }
  }, [connectedAddress, getContract]);

  const value = useMemo<WalletContextValue>(
    () => ({
      connectedAddress,
      walletBalanceEth,
      isWalletConnecting,
      privateBalanceStatus,
      privateBalanceEth,
      privateBalanceHandle,
      privateBalanceError,
      connectWallet,
      disconnectWallet,
      refreshWalletState,
      revealPrivateBalance,
      getContract,
      getSignerClient,
    }),
    [
      connectWallet,
      connectedAddress,
      disconnectWallet,
      getContract,
      getSignerClient,
      isWalletConnecting,
      privateBalanceError,
      privateBalanceEth,
      privateBalanceHandle,
      privateBalanceStatus,
      refreshWalletState,
      revealPrivateBalance,
      walletBalanceEth,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider.");
  }
  return context;
}

function formatWalletBalance(balance: bigint) {
  const formatted = Number(formatEther(balance));
  return formatted.toFixed(formatted >= 1 ? 4 : 6).replace(/\.?0+$/, "");
}

function formatBalanceDisplay(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }
  return numeric.toFixed(numeric >= 1 ? 4 : 6).replace(/\.?0+$/, "");
}
