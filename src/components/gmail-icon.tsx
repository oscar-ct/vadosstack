import type { SVGProps } from "react";

export function GmailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      <path fill="#4285F4" d="M2.4 5.1 5.7 7.6v11.2H3.2a1.6 1.6 0 0 1-1.6-1.6V6.7c0-.7.3-1.3.8-1.6Z" />
      <path fill="#34A853" d="m21.6 5.1-3.3 2.5v11.2h2.5a1.6 1.6 0 0 0 1.6-1.6V6.7c0-.7-.3-1.3-.8-1.6Z" />
      <path fill="#FBBC04" d="M18.3 7.6v11.2H5.7V7.6l6.3 4.8 6.3-4.8Z" />
      <path
        fill="#EA4335"
        d="M20.7 3.4a1.8 1.8 0 0 1 1.7 1.7L12 13 1.6 5.1a1.8 1.8 0 0 1 2.8-1.5L12 9.3l7.6-5.7c.3-.2.7-.3 1.1-.2Z"
      />
    </svg>
  );
}
