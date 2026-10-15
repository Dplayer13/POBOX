"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, ArrowRight, KeyRound } from "lucide-react";
import { WaxSeal } from "./WaxSeal";

export function BoxReveal({
  boxId,
  onEnter,
}: {
  boxId: string;
  onEnter: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(boxId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };
  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="paper relative w-full max-w-md rounded-2xl border border-border/60 p-8 text-center"
        initial={{ y: 14, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 24 }}
      >
        <motion.div
          className="mx-auto"
          initial={{ rotate: -10, scale: 0.7 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
        >
          <WaxSeal size="lg" />
        </motion.div>
        <h2 className="mt-6 font-serif text-2xl font-semibold text-foreground">
          Your box is ready
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          This is your anonymous address. Share it only with people you want
          letters from. You can always find it again from your inbox, but we
          show it here just this once.
        </p>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 px-4 py-3">
          <KeyRound size={16} className="shrink-0 text-gold" />
          <span className="flex-1 text-left font-mono text-base font-semibold tracking-widest text-foreground">
            {boxId}
          </span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy size={13} />
                Copy
              </>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onEnter}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Enter my box
          <ArrowRight size={15} />
        </button>
      </motion.div>
    </motion.div>
  );
}
