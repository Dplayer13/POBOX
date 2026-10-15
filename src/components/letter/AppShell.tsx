"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox, Send, Plus, LogOut, Feather, Clock } from "lucide-react";
import { useAuth } from "@/store/auth";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { BoxIdChip } from "./BoxIdChip";
import { ThemeToggle } from "./ThemeToggle";
import { LetterList } from "./LetterList";
import { Compose } from "./Compose";
import { LetterReader } from "./LetterReader";
import { BoxReveal } from "./BoxReveal";
import { cn } from "@/lib/utils";

type View = "inbox" | "sent" | "compose";

export function AppShell() {
  const me = useAuth((s) => s.me);
  const justSignedUpBoxId = useAuth((s) => s.justSignedUpBoxId);
  const clearJustSignedUp = useAuth((s) => s.clearJustSignedUp);
  const logout = useAuth((s) => s.logout);
  const { toast } = useToast();

  const [view, setView] = useState<View>("inbox");
  const [readingId, setReadingId] = useState<string | null>(null);

  // Counts for the tab badges (poll the same endpoints lightly).
  const inboxQ = useQuery({
    queryKey: ["letters", "inbox"],
    queryFn: api.inbox,
    refetchInterval: 8000,
  });
  const sentQ = useQuery({
    queryKey: ["letters", "sent"],
    queryFn: api.sent,
    refetchInterval: 15000,
  });

  if (!me) return null;
  const boxId = me.boxId;
  const inboxCount = inboxQ.data?.letters.length ?? 0;
  const sentCount = sentQ.data?.letters.length ?? 0;

  async function handleLogout() {
    await logout();
    toast({ title: "Box sealed", description: "You've been logged out." });
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="wax-seal grid h-8 w-8 place-items-center">
              <Feather size={15} className="text-primary-foreground/85" />
            </div>
            <span className="font-serif text-xl font-semibold tracking-tight text-foreground">
              PO Box
            </span>
          </div>

          <div className="order-3 w-full sm:order-2 sm:w-auto sm:ml-2">
            <BoxIdChip boxId={boxId} />
          </div>

          <div className="order-2 ml-auto flex items-center gap-2 sm:order-3">
            <button
              type="button"
              onClick={() => setView("compose")}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Plus size={15} />
              Compose
            </button>
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              title="Log out"
              className="inline-grid h-9 w-9 place-items-center rounded-full border border-border/70 bg-card/70 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {view === "compose" ? (
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-serif text-2xl font-semibold text-foreground">
              Compose
            </h1>
            <button
              type="button"
              onClick={() => setView("sent")}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Back to sent
            </button>
          </div>
        ) : (
          <div className="mb-5 flex items-center gap-1 rounded-full border border-border/60 bg-card/60 p-1 sm:max-w-xs">
            <TabButton
              active={view === "inbox"}
              onClick={() => setView("inbox")}
              icon={<Inbox size={15} />}
              label="Inbox"
              count={inboxCount}
            />
            <TabButton
              active={view === "sent"}
              onClick={() => setView("sent")}
              icon={<Send size={15} />}
              label="Sent"
              count={sentCount}
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {view === "inbox" && (
              <LetterList box="inbox" onOpen={setReadingId} />
            )}
            {view === "sent" && (
              <LetterList box="sent" onOpen={setReadingId} />
            )}
            {view === "compose" && (
              <Compose
                myBoxId={boxId}
                onSent={() => setView("sent")}
                onCancel={() => setView("inbox")}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Sticky footer */}
      <footer className="mt-auto border-t border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-3 text-center text-[11px] text-muted-foreground sm:flex-row sm:px-6 sm:text-left">
          <span className="inline-flex items-center gap-1.5">
            <Feather size={11} className="text-gold" />
            PO Box — slow mail for people who write.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={11} className="text-sepia" />
            Letters travel on a delay, on purpose. ~1 min delivery in this demo.
          </span>
        </div>
      </footer>

      {/* Reader overlay */}
      <AnimatePresence>
        {readingId && (
          <LetterReader
            id={readingId}
            myBoxId={boxId}
            onClose={() => setReadingId(null)}
          />
        )}
      </AnimatePresence>

      {/* Box-id reveal (once, after signup) */}
      <AnimatePresence>
        {justSignedUpBoxId && (
          <BoxReveal
            boxId={justSignedUpBoxId}
            onEnter={clearJustSignedUp}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-1 items-center justify-center gap-2 rounded-full py-1.5 text-sm font-medium transition-colors",
        active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {active && (
        <motion.span
          layoutId="tab-pill"
          className="absolute inset-0 rounded-full bg-primary shadow-sm"
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        {icon}
        {label}
        {count > 0 && (
          <span
            className={cn(
              "min-w-[18px] rounded-full px-1 text-[10px] tabular-nums",
              active
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {count}
          </span>
        )}
      </span>
    </button>
  );
}
