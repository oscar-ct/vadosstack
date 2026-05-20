import { GeistMono } from "geist/font/mono";
import { GeistPixelSquare } from "geist/font/pixel";
import { GeistSans } from "geist/font/sans";

type FontDefinition = {
  label: string;
  variable: string;
  variableClassName?: string;
};

export const fontRegistry = {
  geist: {
    label: "Geist",
    variable: "--font-geist-sans",
    variableClassName: GeistSans.variable,
  },
  inter: {
    label: "Inter",
    variable: "--font-inter",
  },
  notoSans: {
    label: "Noto Sans",
    variable: "--font-noto-sans",
  },
  nunitoSans: {
    label: "Nunito Sans",
    variable: "--font-nunito-sans",
  },
  figtree: {
    label: "Figtree",
    variable: "--font-figtree",
  },
  roboto: {
    label: "Roboto",
    variable: "--font-roboto",
  },
  raleway: {
    label: "Raleway",
    variable: "--font-raleway",
  },
  dmSans: {
    label: "DM Sans",
    variable: "--font-dm-sans",
  },
  publicSans: {
    label: "Public Sans",
    variable: "--font-public-sans",
  },
  outfit: {
    label: "Outfit",
    variable: "--font-outfit",
  },
  geistMono: {
    label: "Geist Mono",
    variable: "--font-geist-mono",
    variableClassName: GeistMono.variable,
  },
  geistPixelSquare: {
    label: "Geist Pixel Square",
    variable: "--font-geist-pixel-square",
    variableClassName: GeistPixelSquare.variable,
  },
  jetBrainsMono: {
    label: "JetBrains Mono",
    variable: "--font-jetbrains-mono",
  },
  notoSerif: {
    label: "Noto Serif",
    variable: "--font-noto-serif",
  },
  robotoSlab: {
    label: "Roboto Slab",
    variable: "--font-roboto-slab",
  },
  merriweather: {
    label: "Merriweather",
    variable: "--font-merriweather",
  },
  lora: {
    label: "Lora",
    variable: "--font-lora",
  },
  playfairDisplay: {
    label: "Playfair Display",
    variable: "--font-playfair-display",
  },
} as const satisfies Record<string, FontDefinition>;

export type FontKey = keyof typeof fontRegistry;

export const fontVars = Object.values(fontRegistry)
  .map((font) => ("variableClassName" in font ? font.variableClassName : undefined))
  .filter(Boolean)
  .join(" ");

export const fontOptions = (Object.entries(fontRegistry) as Array<[FontKey, (typeof fontRegistry)[FontKey]]>).map(
  ([key, font]) => ({
    key,
    label: font.label,
    variable: font.variable,
  }),
);
