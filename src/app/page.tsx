"use client";

import { useEffect } from "react";
import { useAuth } from "@/store/auth";
import { AuthScreen } from "@/components/letter/AuthScreen";
import { AppShell } from "@/components/letter/AppShell";
import { WaxSeal } from "@/components/letter/WaxSeal";

export default function Home() {
  const status = useAuth((s) => s.status);
  const init = useAuth((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <WaxSeal size="md" />
        <span className="font-serif text-sm italic text-muted-foreground">
          Opening the post room…
        </span>
      </div>
    );
  }

  if (status === "unauthed") return <AuthScreen />;

  return <AppShell />;
}
