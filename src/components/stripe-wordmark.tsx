import type * as React from "react";

import { cn } from "@/lib/utils";

export function StripeWordmark({
  className,
  variant = "blurple",
  ...props
}: React.SVGProps<SVGSVGElement> & { variant?: "blurple" | "slate" | "white" }) {
  return (
    <svg
      aria-label="Stripe"
      className={cn(
        "h-auto w-20",
        variant === "blurple" && "text-[#533AFD]",
        variant === "slate" && "text-[#061B31]",
        variant === "white" && "text-white",
        className,
      )}
      fill="none"
      focusable="false"
      role="img"
      viewBox="0 0 360 151"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>Stripe</title>
      <path
        clipRule="evenodd"
        d="M360 78C360 52.4 347.6 32.2 323.9 32.2C300.1 32.2 285.7 52.4 285.7 77.8C285.7 107.9 302.7 123.1 327.1 123.1C339 123.1 348 120.4 354.8 116.6V96.6C348 100 340.2 102.1 330.3 102.1C320.6 102.1 312 98.7 310.9 86.9H359.8C359.8 85.6 360 80.4 360 78ZM310.6 68.5C310.6 57.2 317.5 52.5 323.8 52.5C329.9 52.5 336.4 57.2 336.4 68.5H310.6Z"
        fill="currentColor"
        fillRule="evenodd"
      />
      <path
        clipRule="evenodd"
        d="M247.1 32.2C237.3 32.2 231 36.8 227.5 40L226.2 33.8H204.2V150.4L229.2 145.1L229.3 116.8C232.9 119.4 238.2 123.1 247 123.1C264.9 123.1 281.2 108.7 281.2 77C281.1 48 264.6 32.2 247.1 32.2ZM241.1 101.1C235.2 101.1 231.7 99 229.3 96.4L229.2 59.3C231.8 56.4 235.4 54.4 241.1 54.4C250.2 54.4 256.5 64.6 256.5 77.7C256.5 91.1 250.3 101.1 241.1 101.1Z"
        fill="currentColor"
        fillRule="evenodd"
      />
      <path d="M169.8 26.3L194.9 20.9V.6L169.8 5.9V26.3Z" fill="currentColor" />
      <path d="M194.9 33.9H169.8V121.4H194.9V33.9Z" fill="currentColor" />
      <path
        clipRule="evenodd"
        d="M142.9 41.3L141.3 33.9H119.7V121.4H144.7V62.1C150.6 54.4 160.6 55.8 163.7 56.9V33.9C160.5 32.7 148.8 30.5 142.9 41.3Z"
        fill="currentColor"
        fillRule="evenodd"
      />
      <path
        clipRule="evenodd"
        d="M92.9 12.2L68.5 17.4L68.4 97.5C68.4 112.3 79.5 123.2 94.3 123.2C102.5 123.2 108.5 121.7 111.8 119.9V99.6C108.6 100.9 92.8 105.5 92.8 90.7V55.2H111.8V33.9H92.8L92.9 12.2Z"
        fill="currentColor"
        fillRule="evenodd"
      />
      <path
        clipRule="evenodd"
        d="M25.3 59.3C25.3 55.4 28.5 53.9 33.8 53.9C41.4 53.9 51 56.2 58.6 60.3V36.8C50.3 33.5 42.1 32.2 33.8 32.2C13.5 32.2 0 42.8 0 60.5C0 88.1 38 83.7 38 95.6C38 100.2 34 101.7 28.4 101.7C20.1 101.7 9.5 98.3 1.1 93.7V117.5C10.4 121.5 19.8 123.2 28.4 123.2C49.2 123.2 63.5 112.9 63.5 95C63.4 65.2 25.3 70.5 25.3 59.3Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}
