"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleIcon } from "@/components/icons";
import { useAuth } from "@/components/providers/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { API_BASE_URL } from "@/lib/api/client";

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const ENABLE_DEV_AUTH = process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH === "true";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccountsId = {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: {
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      type?: "standard" | "icon";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      width?: number;
      logo_alignment?: "left" | "center";
    },
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsId;
      };
    };
  }
}

const FEATURE_SECTIONS = [
  {
    title: "Confidential Payments",
    body: "Send encrypted-value transfers through ChapChap so recipients receive funds inside the private contract balance instead of normal wallet ETH.",
  },
  {
    title: "Private Savings",
    body: "Deposit on Sepolia, move value into a private ChapChap savings bucket, and reveal balances only to the connected wallet owner.",
  },
  {
    title: "AI Agreement Escrow",
    body: "Turn plain English into agreement drafts, attach proof later, and use AI-assisted verdict recommendations before settlement.",
  },
  {
    title: "Public or Private Transfers",
    body: "Choose whether a payment should go through ChapChap confidential balance flow or normal public Sepolia ETH delivery.",
  },
  {
    title: "Why Zama",
    body: "Zama/FHEVM lets ChapChap compute over encrypted values where supported, while wallet addresses and transaction existence may still remain public.",
  },
];

export function LoginScreen() {
  const router = useRouter();
  const { hydrated, isAuthenticated, loginWithDevToken, loginWithGoogleIdToken } =
    useAuth();
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const launchSectionRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isGoogleReady, setGoogleReady] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [devToken, setDevToken] = useState("");

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = performance.now();
    const timeoutId = window.setTimeout(() => controller.abort(), 12_000);

    console.info("[ChapChap][Auth] backend warmup started", {
      apiBaseUrl: API_BASE_URL,
    });

    fetch(`${API_BASE_URL}/api/health/`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        console.info("[ChapChap][Auth] backend warmup completed", {
          status: response.status,
          durationMs: Math.round(performance.now() - startedAt),
        });
      })
      .catch((warmupError) => {
        if (controller.signal.aborted) {
          console.info("[ChapChap][Auth] backend warmup still pending after timeout");
          return;
        }
        console.warn("[ChapChap][Auth] backend warmup failed", warmupError);
      })
      .finally(() => window.clearTimeout(timeoutId));

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError("Google sign-in is not configured for this frontend yet.");
      return;
    }

    let cancelled = false;

    const initializeGoogle = () => {
      if (cancelled || !window.google || !buttonContainerRef.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          console.info("[ChapChap][Auth] Google credential received");
          if (!response.credential) {
            setError("Google sign-in did not return a valid credential.");
            return;
          }

          setError(null);
          setSubmitting(true);

          try {
            await loginWithGoogleIdToken(response.credential);
            console.info("[ChapChap][Auth] dashboard route started");
            router.replace("/dashboard");
          } catch (submissionError) {
            setError(getFriendlyError(submissionError));
          } finally {
            setSubmitting(false);
          }
        },
        cancel_on_tap_outside: true,
      });

      buttonContainerRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonContainerRef.current, {
        theme: "filled_black",
        size: "large",
        text: "signin_with",
        shape: "pill",
        width: 320,
        logo_alignment: "left",
      });

      setGoogleReady(true);
    };

    if (window.google?.accounts?.id) {
      initializeGoogle();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_SCRIPT_SRC}"]`,
    );

    const script =
      existingScript ??
      Object.assign(document.createElement("script"), {
        src: GOOGLE_SCRIPT_SRC,
        async: true,
        defer: true,
      });

    const handleLoad = () => initializeGoogle();
    const handleError = () => {
      if (!cancelled) {
        setError("Google sign-in could not be loaded. Please refresh and try again.");
      }
    };

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    if (!existingScript) {
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, [loginWithGoogleIdToken, router]);

  const handleDevTokenSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await loginWithDevToken(devToken);
      router.replace("/dashboard");
    } catch (submissionError) {
      setError(getFriendlyError(submissionError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLaunchClick = () => {
    if (isAuthenticated) {
      router.push("/dashboard");
      return;
    }
    launchSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(118,87,246,0.28),transparent_28rem)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(240,152,115,0.12),transparent_24rem)]" />
      <div className="absolute inset-x-0 bottom-0 h-80 bg-[radial-gradient(circle_at_bottom,rgba(118,87,246,0.18),transparent_62%)]" />

      <div className="relative mx-auto max-w-6xl px-6 py-8 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-lg font-bold text-white shadow-[0_0_60px_rgba(118,87,246,0.18)]">
              C
            </div>
            <div>
              <p className="font-display text-lg font-semibold">ChapChap Confidential</p>
              <p className="text-xs uppercase tracking-[0.26em] text-white/[0.42]">
                Sepolia + Zama/FHEVM
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLaunchClick}
              className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-black"
            >
              Launch App
            </button>
            <button
              type="button"
              onClick={() =>
                document.getElementById("demo-flow")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm font-semibold text-white"
            >
              View Demo Flow
            </button>
          </div>
        </header>

        <section className="grid gap-8 pb-14 pt-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-accent-soft">
              AI-powered private payments, savings, and agreements.
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
              ChapChap Confidential
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/[0.68]">
              Send, save, and settle agreements on Sepolia with confidential logic powered by Zama/FHEVM.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/[0.52]">
              Wallet addresses and transaction existence may still be public, but sensitive values can be encrypted where supported by Zama/FHEVM.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={handleLaunchClick}
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black"
              >
                Launch ChapChap
              </button>
              <button
                type="button"
                onClick={() =>
                  document.getElementById("demo-flow")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
                className="rounded-full border border-white/10 bg-white/[0.05] px-6 py-3 text-sm font-semibold text-white"
              >
                View Demo Flow
              </button>
            </div>
          </div>

          <div className="glass-panel edge-glow rounded-[2.4rem] border border-white/10 p-6 sm:p-8">
            <div className="grid gap-4">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-white/[0.4]">
                  Confidential flow
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  Private transfer
                </p>
                <p className="mt-2 text-sm leading-7 text-white/[0.62]">
                  Encrypt the value client-side, move it through ChapChap private balance, and let the recipient reveal it only after connecting the same wallet.
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-accent/20 to-accent-soft/10 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-white/[0.4]">
                  Public option
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  Normal Sepolia ETH
                </p>
                <p className="mt-2 text-sm leading-7 text-white/[0.62]">
                  Use a direct wallet transfer when the receiver should see funds in MetaMask immediately.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="demo-flow" className="grid gap-5 py-6 md:grid-cols-2 xl:grid-cols-5">
          {FEATURE_SECTIONS.map((section) => (
            <article
              key={section.title}
              className="glass-panel edge-glow rounded-[1.9rem] border border-white/10 p-5"
            >
              <p className="font-display text-xl font-semibold text-white">
                {section.title}
              </p>
              <p className="mt-3 text-sm leading-7 text-white/[0.62]">
                {section.body}
              </p>
            </article>
          ))}
        </section>

        <section ref={launchSectionRef} className="py-12">
          <div className="glass-panel edge-glow mx-auto max-w-xl rounded-[2.5rem] border border-white/10 px-6 py-8 text-center sm:px-8">
            <p className="text-sm uppercase tracking-[0.28em] text-white/[0.42]">
              Launch ChapChap
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-white">
              Sign in to open the dashboard
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-white/[0.58]">
              Continue with Google to access the Assistant, connect MetaMask on Sepolia, reveal ChapChap private balances, and run confidential contract actions.
            </p>

            <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.03] px-5 py-6">
              <div className="mb-4 flex items-center justify-center gap-3 text-white">
                <GoogleIcon className="size-5" />
                <span className="text-sm font-medium text-white/[0.7]">
                  Continue with Google
                </span>
              </div>

              <div className="flex justify-center">
                <div ref={buttonContainerRef} className="min-h-11" />
              </div>

              {!isGoogleReady && !error ? (
                <p className="mt-4 text-sm text-white/[0.45]">
                  Loading secure Google sign-in...
                </p>
              ) : null}
              {isSubmitting ? (
                <p className="mt-4 text-sm text-white/[0.55]">
                  Signing you in. If the backend was asleep, this may take a moment.
                </p>
              ) : null}
            </div>

            {error ? (
              <p className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </p>
            ) : (
              <p className="mt-5 text-sm text-white/[0.45]">
                After sign-in, the dashboard opens at <span className="font-semibold text-white">/dashboard</span>.
              </p>
            )}

            {ENABLE_DEV_AUTH ? (
              <div className="mt-6 text-left">
                <button
                  type="button"
                  onClick={() => setShowDevPanel((current) => !current)}
                  className="text-xs uppercase tracking-[0.24em] text-white/[0.35]"
                >
                  {showDevPanel ? "Hide developer tools" : "Developer tools"}
                </button>

                {showDevPanel ? (
                  <form onSubmit={handleDevTokenSubmit} className="mt-4 space-y-4">
                    <label className="block text-sm text-white/[0.62]">
                      DRF auth token
                      <input
                        value={devToken}
                        onChange={(event) => setDevToken(event.target.value)}
                        placeholder="Paste a backend token for local development."
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/[0.28]"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isSubmitting || !devToken.trim()}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Continue with dev token
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function getFriendlyError(error: unknown) {
  if (
    error instanceof Error &&
    (error.message.includes("Backend is waking up") ||
      error.message.includes("Backend is still starting"))
  ) {
    return "Backend is still starting. Please try again in a moment.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "I couldn't complete sign-in. Please try again.";
}
