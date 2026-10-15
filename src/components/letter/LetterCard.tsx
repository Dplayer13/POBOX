"use client";

import { motion } from "framer-motion";
import { Clock, Paperclip, MailOpen, Send, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { WaxSeal } from "./WaxSeal";
import { relTime, clockTime, countdown } from "@/lib/time";
import type { LetterListItem } from "@/lib/types";
import { useEffect, useState } from "react";

type Role = "sender" | "recipient";
type Status =
  | "sealed"
  | "opened"
  | "transit"
  | "delivered-sealed"
  | "delivered-opened";

function statusFor(l: LetterListItem, role: Role): Status {
  const arrived = new Date(l.deliverAt).getTime() <= Date.now();
  if (role === "recipient") {
    // Inbox letters always arrive (server filters), so we only care opened.
    return l.openedAt ? "opened" : "sealed";
  }
  // Sender view.
  if (!arrived) return "transit";
  if (l.openedAt) return "delivered-opened";
  return "delivered-sealed";
}

/** A live "in 1m 12s" countdown that ticks every second. */
function useCountdown(targetIso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = new Date(targetIso).getTime();
  return Math.max(0, target - now);
}

export function LetterCard({
  letter,
  role,
  onOpen,
}: {
  letter: LetterListItem;
  role: Role;
  onOpen: (id: string) => void;
}) {
  const status = statusFor(letter, role);
  const otherBox =
    role === "recipient" ? letter.senderBoxId : letter.recipientBoxId;
  const direction = role === "recipient" ? "From" : "To";
  const transitMs = useCountdown(letter.deliverAt);
  const arrived =
    status === "opened" ||
    status === "delivered-opened" ||
    status === "delivered-sealed";

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(letter.id)}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "paper group relative block w-full overflow-hidden rounded-lg text-left",
        "border border-border/60 hover:border-primary/40"
      )}
    >
      {/* Flap (top band) */}
      <div className="relative h-10 border-b border-border/60 bg-gradient-to-b from-secondary/60 to-secondary/20">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "repeating-linear-gradient(90deg, transparent 0 22px, oklch(0.5 0.05 55 / 0.10) 22px 23px)",
          }}
        />
        {/* postmark stamp on the right */}
        <div className="absolute right-3 top-1.5 postmark-ring grid h-7 w-7 place-items-center bg-card/70">
          {role === "recipient" ? (
            <span className="font-mono text-[8px] font-semibold tracking-tight text-sepia">
              {clockTime(letter.openedAt ?? letter.deliverAt).slice(0, 5)}
            </span>
          ) : (
            <Send size={12} className="text-sepia" />
          )}
        </div>
      </div>

      {/* Seal / postmark at the flap-body boundary */}
      <div className="pointer-events-none absolute left-1/2 top-[18px] z-10 -translate-x-1/2">
        {status === "sealed" && <WaxSeal size="sm" />}
        {status === "opened" && (
          <div className="grid h-[30px] w-[30px] place-items-center rounded-full bg-card shadow ring-1 ring-border/60">
            <MailOpen size={15} className="text-sepia" />
          </div>
        )}
        {status === "transit" && (
          <div className="postmark-ring grid h-[30px] w-[30px] place-items-center bg-card">
            <Clock size={13} className="text-sepia" />
          </div>
        )}
        {status === "delivered-sealed" && <WaxSeal size="sm" />}
        {status === "delivered-opened" && (
          <div className="grid h-[30px] w-[30px] place-items-center rounded-full bg-card shadow ring-1 ring-border/60">
            <CheckCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pb-4 pt-7">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="min-w-0 text-xs text-muted-foreground">
            <span className="uppercase tracking-wide">{direction}</span>{" "}
            <span className="font-mono font-semibold text-foreground/90">
              {otherBox}
            </span>
          </div>
          <div className="shrink-0 text-[11px] text-muted-foreground">
            {status === "transit"
              ? `arrives in ${countdown(transitMs)}`
              : role === "recipient"
                ? `arrived ${relTime(letter.openedAt ?? letter.deliverAt)}`
                : status === "delivered-opened"
                  ? `opened ${relTime(letter.openedAt!)}`
                  : `sent ${relTime(letter.sentAt)}`}
          </div>
        </div>

        {/* Status / preview */}
        {status === "sealed" ? (
          <div className="flex items-center gap-2 py-1 text-sm italic text-sepia">
            <span className="font-serif">Sealed — tap to break the wax</span>
          </div>
        ) : status === "transit" ? (
          <div className="py-1 text-sm italic text-sepia">
            <span className="font-serif">In transit · {countdown(transitMs)} to arrival</span>
          </div>
        ) : (
          <p className="line-clamp-2 font-serif text-sm leading-snug text-foreground/90">
            {letter.preview || (
              <span className="text-muted-foreground italic">
                {letter.attachmentCount > 0 ? "A letter with attachments." : "—"}
              </span>
            )}
          </p>
        )}

        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock size={11} />
            {clockTime(
              role === "recipient"
                ? letter.openedAt ?? letter.deliverAt
                : letter.sentAt
            )}
          </span>
          {letter.attachmentCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip size={11} />
              {letter.attachmentCount}{" "}
              {letter.attachmentCount === 1 ? "file" : "files"}
            </span>
          )}
          {arrived && role === "recipient" && (
            <span className="ml-auto inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCheck size={11} />
              read
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
