"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, KeyRound, ShieldCheck, Clock, Loader2 } from "lucide-react";
import { useAuth } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { WaxSeal } from "./WaxSeal";
import { cn } from "@/lib/utils";

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = useAuth((s) => s.login);
  const signup = useAuth((s) => s.signup);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && password.length < 8) {
      setError("Pick a password of at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "signup") await signup(email.trim(), password);
      else await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-10 px-5 py-12 lg:flex-row lg:gap-16">
      {/* Brand hero */}
      <div className="flex max-w-md flex-col items-center text-center lg:items-start lg:text-left">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          className="mx-auto lg:mx-0"
        >
          <WaxSeal size="lg" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 font-serif text-5xl font-semibold tracking-tight text-foreground sm:text-6xl"
        >
          PO Box
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mt-2 font-serif text-lg italic text-sepia"
        >
          slow mail for people who write
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
          className="mt-5 text-sm leading-relaxed text-muted-foreground"
        >
          You get an anonymous box ID. Anyone who knows it can send you a
          letter — text and files. Only you can open your box. Letters are
          sealed, take a little while to arrive, and live behind a wax seal
          until you break it.
        </motion.p>

        <ul className="mt-7 flex flex-col gap-2.5 text-sm">
          {[
            { icon: KeyRound, text: "A random box ID, not your name or number." },
            { icon: ShieldCheck, text: "Only the box owner reads their inbox." },
            { icon: Clock, text: "Letters arrive on a delay, like real post." },
          ].map(({ icon: Icon, text }, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.34 + i * 0.07 }}
              className="flex items-center gap-2.5 text-muted-foreground"
            >
              <Icon size={15} className="shrink-0 text-gold" />
              {text}
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Auth card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="paper w-full max-w-sm rounded-2xl border border-border/60 p-7"
      >
        {/* Segmented control */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-secondary/60 p-1 text-sm">
          {(["signup", "login"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn(
                "relative rounded-full py-2 font-medium transition-colors",
                mode === m
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {mode === m && (
                <motion.span
                  layoutId="auth-tab"
                  className="absolute inset-0 rounded-full bg-primary shadow-sm"
                  transition={{ type: "spring", stiffness: 320, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                {m === "signup" ? "Create a box" : "Log in"}
              </span>
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="rounded-md border border-border/70 bg-background/60 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Password {mode === "signup" && "(min 8 chars)"}
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="rounded-md border border-border/70 bg-background/60 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                <Mail size={13} className="shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            {submitting
              ? "Sealing your box…"
              : mode === "signup"
                ? "Create my box"
                : "Open my box"}
          </button>

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            {mode === "signup"
              ? "Signing up creates a box and shows you its ID once."
              : "You'll need your email and password to open your box."}
          </p>
        </form>
      </motion.div>
    </div>
  );
}
