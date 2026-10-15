"use client";

import { useState } from "react";
import { Copy, Check, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

/** A copyable chip showing the user's anonymous box id. */
export function BoxIdChip({
  boxId,
  className,
  label = "Your box",
}: {
  boxId: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(boxId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — ignore */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy your box ID to share"
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-xs transition-colors hover:bg-secondary/60",
        className
      )}
    >
      <KeyRound size={13} className="text-gold" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold tracking-wider text-foreground">
        {boxId}
      </span>
      {copied ? (
        <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy
          size={13}
          className="text-muted-foreground group-hover:text-foreground"
        />
      )}
    </button>
  );
}
