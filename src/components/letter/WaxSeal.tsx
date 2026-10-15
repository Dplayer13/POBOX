"use client";

import { motion } from "framer-motion";
import { Feather } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = { sm: 30, md: 56, lg: 104 } as const;
const ICON = { sm: 14, md: 26, lg: 46 } as const;

/**
 * A wax seal. Sealed by default; when `breaking` is true it runs a short
 * keyframe animation (scale + crack + fade) to look like the seal cracking open.
 */
export function WaxSeal({
  size = "md",
  breaking = false,
  className,
  style,
}: {
  size?: keyof typeof SIZES;
  breaking?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const dim = SIZES[size];
  return (
    <motion.div
      className={cn(
        "wax-seal relative grid place-items-center select-none pointer-events-none",
        className
      )}
      style={{ width: dim, height: dim, ...style }}
      initial={false}
      animate={
        breaking
          ? { scale: [1, 1.18, 1.12], rotate: [0, -2, 7], opacity: [1, 1, 0] }
          : { scale: 1, rotate: 0, opacity: 1 }
      }
      transition={
        breaking
          ? { duration: 0.95, times: [0, 0.42, 1], ease: "easeInOut" }
          : { duration: 0.2 }
      }
    >
      {/* Embossed emblem (a quill), darker emboss via drop-shadow. */}
      <Feather
        size={ICON[size]}
        className="text-primary-foreground/85"
        style={{
          filter: "drop-shadow(0 1px 0 oklch(0.22 0.08 22 / 0.65))",
        }}
      />
      {/* A faint inner ring, like an embossed border on real wax. */}
      <div
        className="absolute rounded-full"
        style={{
          inset: dim * 0.14,
          boxShadow:
            "inset 0 0 0 1.5px oklch(0.3 0.1 24 / 0.55), inset 0 1px 2px oklch(0.8 0.16 30 / 0.5)",
        }}
      />
      {breaking && (
        <motion.svg
          className="absolute inset-0"
          viewBox="0 0 100 100"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1] }}
          transition={{ duration: 0.45, times: [0, 0.5, 1] }}
        >
          <motion.path
            d="M50 6 L46 40 L54 50 L42 70 L50 94"
            stroke="oklch(0.18 0.06 22 / 0.85)"
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </motion.svg>
      )}
    </motion.div>
  );
}
