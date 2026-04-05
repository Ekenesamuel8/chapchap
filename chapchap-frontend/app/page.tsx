import Link from "next/link";
import { GoogleIcon } from "@/components/icons";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(118,87,246,0.18),transparent_22rem)]" />
      <div className="absolute inset-x-0 bottom-0 h-72 bg-[radial-gradient(circle_at_bottom,rgba(240,152,115,0.18),transparent_65%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <section className="glass-panel edge-glow w-full max-w-md rounded-[2.5rem] border border-white/10 px-6 py-10 text-center sm:px-8 sm:py-12">
          <div className="mx-auto mb-16 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 text-4xl text-white shadow-[0_0_60px_rgba(118,87,246,0.22)]">
            C
          </div>

          <h1 className="font-display text-5xl font-bold tracking-tight text-white sm:text-6xl">
            Chap Chap
          </h1>
          <p className="mx-auto mt-6 max-w-sm text-base leading-8 text-white/[0.62]">
            Your AI wallet for payments, shopping, and digital purchases.
          </p>

          <div className="mt-16 space-y-4">
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-base font-semibold text-[#111111] shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
            >
              <GoogleIcon />
              Sign in with Google
            </Link>

            <p className="text-sm text-white/[0.45]">
              Built for Etherlink users who want crypto to feel simple.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
