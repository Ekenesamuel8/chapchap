"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleIcon } from "@/components/icons";
import { useAuth } from "@/components/providers/auth-provider";

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
  prompt: () => void;
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

export function LoginScreen() {
  const router = useRouter();
  const { hydrated, isAuthenticated, loginWithDevToken, loginWithGoogleIdToken } =
    useAuth();
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
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
          if (!response.credential) {
            setError("Google sign-in did not return a valid credential.");
            return;
          }

          setError(null);
          setSubmitting(true);

          try {
            await loginWithGoogleIdToken(response.credential);
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

  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(118,87,246,0.18),transparent_22rem)]" />
      <div className="absolute inset-x-0 bottom-0 h-72 bg-[radial-gradient(circle_at_bottom,rgba(240,152,115,0.18),transparent_65%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <section className="glass-panel edge-glow w-full max-w-md rounded-[2.5rem] border border-white/10 px-6 py-10 text-center sm:px-8 sm:py-12">
          <div className="mx-auto mb-14 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 text-4xl text-white shadow-[0_0_60px_rgba(118,87,246,0.22)]">
            C
          </div>

          <h1 className="font-display text-5xl font-bold tracking-tight text-white sm:text-6xl">
            Chap Chap
          </h1>
          <p className="mx-auto mt-5 max-w-sm text-base leading-8 text-white/[0.62]">
            Your AI wallet for payments, shopping, and digital purchases.
          </p>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-7 text-white/[0.48]">
            Sign in once and let ChapChap turn plain-language requests into
            secure, reviewable wallet actions.
          </p>

          <div className="mt-12 rounded-[2rem] border border-white/10 bg-white/[0.03] px-5 py-6">
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
          </div>

          {error ? (
            <p className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </p>
          ) : (
            <p className="mt-5 text-sm text-white/[0.45]">
              Your wallet profile and dashboard will load automatically after
              sign-in.
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
        </section>
      </div>
    </main>
  );
}

function getFriendlyError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "I couldn't complete sign-in. Please try again.";
}
