"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  X,
  Paperclip,
  Download,
  Loader2,
  Feather,
  MailOpen,
  Clock,
  CheckCheck,
} from "lucide-react";
import { api, attachmentUrl, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { WaxSeal } from "./WaxSeal";
import { fullTime, relTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { AttachmentPublic } from "@/lib/types";

type Phase = "loading" | "sealed" | "breaking" | "revealed" | "error";

export function LetterReader({
  id,
  myBoxId,
  onClose,
}: {
  id: string;
  myBoxId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery({
    queryKey: ["letter", id],
    queryFn: () => api.letter(id),
    enabled: !!id,
  });
  const letter = q.data?.letter;
  const isRecipient = letter?.recipientBoxId === myBoxId;
  const isSender = letter?.senderBoxId === myBoxId;

  // Decide initial phase once the letter loads.
  const [phase, setPhase] = useState<Phase>("loading");
  useEffect(() => {
    if (q.isLoading) {
      setPhase("loading");
      return;
    }
    if (q.isError || !letter) {
      setPhase("error");
      return;
    }
    if (isRecipient && !letter.openedAt) setPhase("sealed");
    else setPhase("revealed");
  }, [q.isLoading, q.isError, letter, isRecipient]);

  // Esc closes the reader.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function breakSeal() {
    if (phase !== "sealed" || !letter) return;
    setPhase("breaking");
    // Open the letter on the server; the body is already in hand, but we mark
    // it opened so the inbox list updates its state. Run in parallel with the
    // seal-break animation (~0.95s).
    try {
      const updated = await api.open(letter.id);
      // api.open already returns { letter: LetterDetail } — set the cache to
      // that exact shape (don't re-wrap).
      qc.setQueryData(["letter", letter.id], updated);
      qc.invalidateQueries({ queryKey: ["letters"] });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Couldn't open the letter.";
      toast({ title: "Hmm", description: msg, variant: "destructive" });
    }
    // Reveal shortly after the animation finishes.
    window.setTimeout(() => setPhase("revealed"), 850);
  }

  const arrived = letter
    ? new Date(letter.deliverAt).getTime() <= Date.now()
    : false;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 px-3 py-6 backdrop-blur-sm sm:py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="paper relative my-auto w-full max-w-2xl rounded-xl border border-border/60"
        initial={{ y: 12, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close letter"
          className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full bg-card/80 text-muted-foreground shadow ring-1 ring-border/60 transition-colors hover:text-foreground"
        >
          <X size={16} />
        </button>

        {phase === "loading" && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 py-20 text-muted-foreground">
            <Loader2 size={22} className="animate-spin text-sepia" />
            <span className="text-sm">Opening the envelope…</span>
          </div>
        )}

        {phase === "error" && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <MailOpen size={28} className="text-sepia" />
            <p className="font-serif text-lg text-foreground">
              This letter isn't available
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              It may belong to another box, or it hasn't arrived yet.
            </p>
          </div>
        )}

        {letter && phase !== "loading" && phase !== "error" && (
          <>
            {/* Header */}
            <div className="flex flex-col gap-2 border-b border-border/60 bg-secondary/30 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="text-muted-foreground">From</span>
                <span className="font-mono font-semibold tracking-wide text-foreground">
                  {letter.senderBoxId}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="font-mono font-semibold tracking-wide text-foreground">
                  {letter.recipientBoxId}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Feather size={11} className="text-gold" />
                  {fullTime(letter.sentAt)}
                </span>
              </div>
            </div>

            {/* Status row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 pt-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock size={11} />
                {arrived
                  ? `Arrived ${relTime(letter.deliverAt)}`
                  : `Arrives ${relTime(letter.deliverAt)}`}
              </span>
              {isSender && !isRecipient && (
                <span className="inline-flex items-center gap-1">
                  {letter.openedAt ? (
                    <>
                      <CheckCheck size={11} className="text-emerald-600 dark:text-emerald-400" />
                      Opened by recipient {relTime(letter.openedAt)}
                    </>
                  ) : arrived ? (
                    <>
                      <MailOpen size={11} className="text-sepia" />
                      Delivered · still sealed by recipient
                    </>
                  ) : (
                    <>
                      <Clock size={11} />
                      In transit
                    </>
                  )}
                </span>
              )}
              {isRecipient && letter.openedAt && (
                <span className="inline-flex items-center gap-1">
                  <MailOpen size={11} className="text-sepia" />
                  Opened {relTime(letter.openedAt)}
                </span>
              )}
            </div>

            {/* Body (revealed) */}
            <motion.div
              className="relative px-6 py-6"
              initial={false}
              animate={
                phase === "revealed"
                  ? { opacity: 1, filter: "blur(0px)" }
                  : { opacity: 0.15, filter: "blur(8px)" }
              }
              transition={{ duration: 0.5 }}
            >
              <div className="letter-prose text-[1.02rem]">
                {letter.body || (
                  <span className="italic text-muted-foreground">
                    (no message — only attachments)
                  </span>
                )}
              </div>

              {/* Attachments */}
              {letter.attachments.length > 0 && (
                <div className="mt-6 border-t border-border/60 pt-4">
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Paperclip size={12} />
                    {letter.attachments.length} enclosed
                  </div>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {letter.attachments.map((a) => (
                      <AttachmentRow key={a.id} attachment={a} />
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>

            {/* Seal overlay (recipient, sealed/breaking) */}
            {(phase === "sealed" || phase === "breaking") && (
              <motion.button
                type="button"
                onClick={breakSeal}
                disabled={phase === "breaking"}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: phase === "breaking" ? 0 : 1 }}
                transition={{ duration: 0.6 }}
                style={{
                  background:
                    "radial-gradient(circle at center, oklch(0.985 0.009 85 / 0.96) 0%, oklch(0.96 0.012 85 / 0.99) 60%)",
                }}
                aria-label="Break the wax seal"
              >
                <WaxSeal size="lg" breaking={phase === "breaking"} />
                {phase !== "breaking" && (
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-serif text-lg italic text-sepia">
                      Sealed
                    </span>
                    <span className="text-xs text-muted-foreground">
                      tap to break the wax
                    </span>
                  </div>
                )}
              </motion.button>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function AttachmentRow({ attachment }: { attachment: AttachmentPublic }) {
  return (
    <li>
      <a
        href={attachmentUrl(attachment.id)}
        // The auth-checked route streams the file as an attachment.
        download={attachment.filename}
        className={cn(
          "group flex items-center gap-2 rounded-md border border-border/60 bg-card/70 px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-secondary/60"
        )}
      >
        <Paperclip size={14} className="shrink-0 text-sepia" />
        <span className="min-w-0 flex-1 truncate text-foreground">
          {attachment.filename}
        </span>
        <Download
          size={14}
          className="shrink-0 text-muted-foreground group-hover:text-primary"
        />
      </a>
    </li>
  );
}
