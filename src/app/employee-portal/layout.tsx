import type { ReactNode } from "react";

import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      noimageindex: true,
      nosnippet: true,
    },
  },
};

export default function EmployeeTimeTrackingLayout({ children }: { children: ReactNode }) {
  return children;
}
