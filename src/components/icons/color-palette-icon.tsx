import type { SVGProps } from "react";

export function ColorPaletteIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      focusable="false"
      shapeRendering="geometricPrecision"
      {...props}
    >
      <title>Color palette</title>
      <circle cx="12" cy="5.5" r="4.4" fill="#5681f5" fillOpacity="0.88" />
      <circle cx="17.4" cy="8.7" r="4.4" fill="#ffb51b" fillOpacity="0.88" />
      <circle cx="17.4" cy="15.2" r="4.4" fill="#20b6b2" fillOpacity="0.88" />
      <circle cx="12" cy="18.4" r="4.4" fill="#7658f6" fillOpacity="0.88" />
      <circle cx="6.6" cy="15.2" r="4.4" fill="#ff3f7f" fillOpacity="0.88" />
      <circle cx="6.6" cy="8.7" r="4.4" fill="#ffd91a" fillOpacity="0.88" />
    </svg>
  );
}
