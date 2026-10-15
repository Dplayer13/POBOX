"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted && theme === "dark";
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      title={isDark ? "Lamplight off" : "Lamplight on"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-grid h-9 w-9 place-items-center rounded-full border border-border/70 bg-card/70 text-foreground transition-colors hover:bg-secondary/60",
        className
      )}
    >
      {mounted ? (
        isDark ? (
          <Sun size={16} className="text-gold" />
        ) : (
          <Moon size={16} className="text-sepia" />
        )
      ) : (
        <span className="h-4 w-4" />
      )}
    </button>
  );
}
