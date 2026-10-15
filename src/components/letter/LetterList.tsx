"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Mailbox, Send, Inbox as InboxIcon, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { LetterCard } from "./LetterCard";
import { cn } from "@/lib/utils";
import type { LetterListItem } from "@/lib/types";

export function LetterList({
  box,
  onOpen,
}: {
  box: "inbox" | "sent";
  onOpen: (id: string) => void;
}) {
  const { toast } = useToast();
  const q = useQuery({
    queryKey: ["letters", box],
    queryFn: box === "inbox" ? api.inbox : api.sent,
    // Inbox polls faster — that's where "a letter arrived" matters.
    refetchInterval: box === "inbox" ? 8000 : 15000,
  });
  const letters = q.data?.letters ?? [];

  // Detect brand-new arrivals (only after the first successful fetch).
  const seenIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (box !== "inbox" || !q.data) return;
    const ids = q.data.letters.map((l) => l.id);
    if (seenIds.current === null) {
      seenIds.current = new Set(ids);
      return;
    }
    const prev = seenIds.current;
    const fresh = ids.filter((id) => !prev.has(id));
    if (fresh.length > 0) {
      seenIds.current = new Set(ids);
      const count = fresh.length;
      toast({
        title: "A letter arrived ✉",
        description:
          count === 1
            ? "One new letter is waiting in your box, sealed."
            : `${count} new letters are waiting in your box.`,
      });
    }
  }, [q.data, box, toast]);

  if (q.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="paper h-40 animate-pulse rounded-lg"
            style={{ opacity: 0.5 }}
          />
        ))}
      </div>
    );
  }

  if (letters.length === 0) {
    return <EmptyState box={box} />;
  }

  return (
    <div
      className={cn(
        "grid gap-4",
        "sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
      )}
    >
      <AnimatePresence initial={false}>
        {letters.map((l: LetterListItem) => (
          <motion.div
            key={l.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
          >
            <LetterCard
              letter={l}
              role={box === "inbox" ? "recipient" : "sender"}
              onOpen={onOpen}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ box }: { box: "inbox" | "sent" }) {
  return (
    <div className="paper mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl px-8 py-14 text-center">
      <div className="relative">
        {box === "inbox" ? (
          <Mailbox size={56} className="text-sepia" strokeWidth={1.4} />
        ) : (
          <Send size={56} className="text-sepia" strokeWidth={1.4} />
        )}
        <Sparkles
          size={16}
          className="absolute -right-1 -top-1 text-gold"
        />
      </div>
      <h3 className="font-serif text-xl text-foreground">
        {box === "inbox" ? "Your box is quiet" : "Nothing sent yet"}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {box === "inbox"
          ? "Share your box ID with someone you'd like to hear from. When a letter arrives, it will appear here, sealed — tap to break the wax."
          : "Write your first letter. Pick a box ID it should travel to, write on the paper, and send it on its way."}
      </p>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        {box === "inbox" ? (
          <InboxIcon size={13} />
        ) : (
          <Send size={13} />
        )}
        <span>
          {box === "inbox"
            ? "Letters take about a minute to arrive in this demo."
            : "Sent letters take about a minute to arrive."}
        </span>
      </div>
    </div>
  );
}
