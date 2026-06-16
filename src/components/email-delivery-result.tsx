"use client";

import * as React from "react";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check, MailCheck, MailX, SendHorizontal, X } from "lucide-react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export type EmailDeliveryResultValue = {
  id?: number | string;
  message: string;
  type: "error" | "success";
};

const burstPieces = [
  { rotate: -18, scale: 0.82, x: -118, y: -72 },
  { rotate: 20, scale: 1, x: -82, y: 84 },
  { rotate: 52, scale: 0.72, x: -30, y: -122 },
  { rotate: -46, scale: 1.08, x: 42, y: 116 },
  { rotate: 16, scale: 0.9, x: 104, y: -74 },
  { rotate: -22, scale: 0.78, x: 132, y: 34 },
  { rotate: 72, scale: 0.68, x: 4, y: 136 },
  { rotate: -70, scale: 0.82, x: -138, y: 10 },
];

const orbitDots = [
  { delay: 0, id: "upper-left", size: "size-2", x: -74, y: -48 },
  { delay: 0.06, id: "lower-left", size: "size-1.5", x: -44, y: 70 },
  { delay: 0.1, id: "upper-right", size: "size-2.5", x: 54, y: -66 },
  { delay: 0.16, id: "lower-right", size: "size-1.5", x: 82, y: 38 },
];

export function EmailDeliveryResult({
  className,
  onDone,
  result,
}: {
  className?: string;
  onDone?: () => void;
  result?: EmailDeliveryResultValue | null;
}) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!result) return;

    const timeout = window.setTimeout(onDone ?? (() => undefined), result.type === "success" ? 3200 : 4400);

    return () => window.clearTimeout(timeout);
  }, [onDone, result]);

  if (!mounted) return null;

  const isSuccess = result?.type === "success";
  const tone = isSuccess
    ? {
        accent: "bg-emerald-500",
        badge: "from-emerald-400 via-teal-400 to-cyan-500",
        border: "border-emerald-300/70 dark:border-emerald-400/30",
        glow: "shadow-emerald-500/30",
        ring: "border-emerald-300/50",
        soft: "bg-emerald-400/15",
        text: "text-emerald-950 dark:text-emerald-50",
        title: "Email sent",
      }
    : {
        accent: "bg-rose-500",
        badge: "from-rose-500 via-red-500 to-orange-400",
        border: "border-rose-300/70 dark:border-rose-400/30",
        glow: "shadow-rose-500/30",
        ring: "border-rose-300/50",
        soft: "bg-rose-400/15",
        text: "text-rose-950 dark:text-rose-50",
        title: "Email needs attention",
      };

  return createPortal(
    <AnimatePresence>
      {result ? (
        <motion.div
          key={`${result.type}-${result.id ?? result.message}`}
          className="pointer-events-none fixed inset-0 z-[100] grid place-items-center overflow-hidden px-4 py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role={result.type === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-background/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            aria-hidden
            className={cn("absolute size-72 rounded-full blur-3xl", tone.soft)}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.5 }}
            animate={reduceMotion ? undefined : { opacity: [0, 1, 0.72], scale: [0.5, 1.2, 1] }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.78, ease: "easeOut" }}
          />
          <motion.div
            className={cn(
              "relative w-full max-w-md overflow-hidden rounded-[2rem] border bg-background/95 p-6 text-center shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8",
              tone.border,
              tone.text,
              className,
            )}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotateX: 18, scale: 0.72, y: 42 }}
            animate={
              reduceMotion
                ? { opacity: 1 }
                : {
                    opacity: 1,
                    rotateX: 0,
                    scale: 1,
                    x: isSuccess ? 0 : [0, -9, 9, -5, 5, 0],
                    y: 0,
                  }
            }
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 18 }}
            transition={
              reduceMotion
                ? { duration: 0.15 }
                : {
                    default: { type: "spring", stiffness: 360, damping: 25 },
                    x: { delay: 0.18, duration: 0.42, ease: "easeOut" },
                  }
            }
            style={{ transformPerspective: 1000 }}
          >
            <motion.div
              aria-hidden
              className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.42),transparent_72%)]"
            />
            <motion.span
              aria-hidden
              className={cn("absolute top-9 left-1/2 size-28 -translate-x-1/2 rounded-full border", tone.ring)}
              initial={reduceMotion ? false : { opacity: 0.9, scale: 0.68 }}
              animate={reduceMotion ? undefined : { opacity: 0, scale: 2.15 }}
              transition={{ delay: 0.1, duration: 1.1, ease: "easeOut" }}
            />
            {burstPieces.map((piece, index) => (
              <motion.span
                aria-hidden
                className={cn("absolute top-20 left-1/2 h-2 w-7 rounded-full", tone.accent)}
                initial={reduceMotion ? false : { opacity: 0, rotate: 0, scale: 0.35, x: 0, y: 0 }}
                animate={
                  reduceMotion
                    ? undefined
                    : {
                        opacity: [0, 1, 0],
                        rotate: piece.rotate,
                        scale: [0.35, piece.scale, 0.5],
                        x: piece.x,
                        y: piece.y,
                      }
                }
                // biome-ignore lint/suspicious/noArrayIndexKey: static particle positions are display-only.
                key={index}
                transition={{ delay: 0.14 + index * 0.025, duration: isSuccess ? 0.9 : 0.62, ease: "easeOut" }}
              />
            ))}
            {orbitDots.map((dot) => (
              <motion.span
                aria-hidden
                className={cn("absolute top-20 left-1/2 rounded-full", tone.accent, dot.size)}
                initial={reduceMotion ? false : { opacity: 0, scale: 0, x: 0, y: 0 }}
                animate={reduceMotion ? undefined : { opacity: [0, 1, 0.15], scale: [0, 1, 0.6], x: dot.x, y: dot.y }}
                key={dot.id}
                transition={{ delay: 0.2 + dot.delay, duration: 1.2, ease: "easeOut" }}
              />
            ))}
            <div className="relative mx-auto grid size-32 place-items-center">
              <motion.span
                aria-hidden
                className={cn("absolute inset-0 rounded-full bg-gradient-to-br opacity-25 blur-xl", tone.badge)}
                initial={reduceMotion ? false : { scale: 0.6 }}
                animate={reduceMotion ? undefined : { scale: [0.6, 1.15, 0.95] }}
                transition={{ duration: 0.75, ease: "easeOut" }}
              />
              <motion.span
                className={cn(
                  "relative grid size-24 place-items-center rounded-[1.75rem] bg-gradient-to-br text-white shadow-2xl",
                  tone.badge,
                  tone.glow,
                )}
                initial={reduceMotion ? false : { rotate: isSuccess ? -18 : 12, scale: 0.58 }}
                animate={reduceMotion ? undefined : { rotate: 0, scale: [0.58, 1.16, 1] }}
                transition={{ delay: 0.04, duration: 0.62, ease: [0.2, 0.9, 0.2, 1] }}
              >
                {isSuccess ? <MailCheck className="size-11" /> : <MailX className="size-11" />}
              </motion.span>
              <motion.span
                className="absolute right-1 bottom-3 grid size-10 place-items-center rounded-full bg-background shadow-lg ring-1 ring-border"
                initial={reduceMotion ? false : { scale: 0, y: 10 }}
                animate={reduceMotion ? undefined : { scale: 1, y: 0 }}
                transition={{ delay: 0.32, type: "spring", stiffness: 520, damping: 24 }}
              >
                {isSuccess ? <Check className="size-5 text-emerald-600" /> : <X className="size-5 text-rose-600" />}
              </motion.span>
            </div>
            <motion.div
              className="mt-2 flex items-center justify-center gap-2 font-semibold text-muted-foreground text-sm uppercase tracking-[0.18em]"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.28 }}
            >
              {isSuccess ? <SendHorizontal className="size-4" /> : <AlertTriangle className="size-4" />}
              Delivery status
            </motion.div>
            <motion.h2
              className="mt-3 font-semibold text-2xl tracking-normal sm:text-3xl"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 0.34, duration: 0.3 }}
            >
              {tone.title}
            </motion.h2>
            <motion.p
              className="mx-auto mt-2 max-w-sm text-muted-foreground text-sm leading-6"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.3 }}
            >
              {result.message}
            </motion.p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
