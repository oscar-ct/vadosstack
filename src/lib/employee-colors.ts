export const employeeColors = [
  {
    key: "sky",
    label: "Sky",
    dot: "bg-sky-500",
    fill: "bg-sky-400/80 dark:bg-sky-500/75",
    panel: "border-sky-200 bg-sky-50/80 dark:border-sky-900/70 dark:bg-sky-950/25",
    text: "text-sky-700 dark:text-sky-300",
  },
  {
    key: "emerald",
    label: "Emerald",
    dot: "bg-emerald-500",
    fill: "bg-emerald-400/80 dark:bg-emerald-500/75",
    panel: "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/70 dark:bg-emerald-950/25",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  {
    key: "amber",
    label: "Amber",
    dot: "bg-amber-500",
    fill: "bg-amber-400/80 dark:bg-amber-500/75",
    panel: "border-amber-200 bg-amber-50/80 dark:border-amber-900/70 dark:bg-amber-950/25",
    text: "text-amber-700 dark:text-amber-300",
  },
  {
    key: "rose",
    label: "Rose",
    dot: "bg-rose-500",
    fill: "bg-rose-400/80 dark:bg-rose-500/75",
    panel: "border-rose-200 bg-rose-50/80 dark:border-rose-900/70 dark:bg-rose-950/25",
    text: "text-rose-700 dark:text-rose-300",
  },
  {
    key: "indigo",
    label: "Indigo",
    dot: "bg-indigo-500",
    fill: "bg-indigo-400/80 dark:bg-indigo-500/75",
    panel: "border-indigo-200 bg-indigo-50/80 dark:border-indigo-900/70 dark:bg-indigo-950/25",
    text: "text-indigo-700 dark:text-indigo-300",
  },
  {
    key: "violet",
    label: "Violet",
    dot: "bg-violet-500",
    fill: "bg-violet-400/80 dark:bg-violet-500/75",
    panel: "border-violet-200 bg-violet-50/80 dark:border-violet-900/70 dark:bg-violet-950/25",
    text: "text-violet-700 dark:text-violet-300",
  },
  {
    key: "cyan",
    label: "Cyan",
    dot: "bg-cyan-500",
    fill: "bg-cyan-400/80 dark:bg-cyan-500/75",
    panel: "border-cyan-200 bg-cyan-50/80 dark:border-cyan-900/70 dark:bg-cyan-950/25",
    text: "text-cyan-700 dark:text-cyan-300",
  },
  {
    key: "orange",
    label: "Orange",
    dot: "bg-orange-500",
    fill: "bg-orange-400/80 dark:bg-orange-500/75",
    panel: "border-orange-200 bg-orange-50/80 dark:border-orange-900/70 dark:bg-orange-950/25",
    text: "text-orange-700 dark:text-orange-300",
  },
  {
    key: "teal",
    label: "Teal",
    dot: "bg-teal-500",
    fill: "bg-teal-400/80 dark:bg-teal-500/75",
    panel: "border-teal-200 bg-teal-50/80 dark:border-teal-900/70 dark:bg-teal-950/25",
    text: "text-teal-700 dark:text-teal-300",
  },
  {
    key: "pink",
    label: "Pink",
    dot: "bg-pink-500",
    fill: "bg-pink-400/80 dark:bg-pink-500/75",
    panel: "border-pink-200 bg-pink-50/80 dark:border-pink-900/70 dark:bg-pink-950/25",
    text: "text-pink-700 dark:text-pink-300",
  },
  {
    key: "blue",
    label: "Blue",
    dot: "bg-blue-600",
    fill: "bg-blue-400/80 dark:bg-blue-500/75",
    panel: "border-blue-200 bg-blue-50/80 dark:border-blue-900/70 dark:bg-blue-950/25",
    text: "text-blue-700 dark:text-blue-300",
  },
  {
    key: "lime",
    label: "Lime",
    dot: "bg-lime-500",
    fill: "bg-lime-400/80 dark:bg-lime-500/75",
    panel: "border-lime-200 bg-lime-50/80 dark:border-lime-900/70 dark:bg-lime-950/25",
    text: "text-lime-700 dark:text-lime-300",
  },
  {
    key: "fuchsia",
    label: "Fuchsia",
    dot: "bg-fuchsia-500",
    fill: "bg-fuchsia-400/80 dark:bg-fuchsia-500/75",
    panel: "border-fuchsia-200 bg-fuchsia-50/80 dark:border-fuchsia-900/70 dark:bg-fuchsia-950/25",
    text: "text-fuchsia-700 dark:text-fuchsia-300",
  },
  {
    key: "red",
    label: "Red",
    dot: "bg-red-500",
    fill: "bg-red-400/80 dark:bg-red-500/75",
    panel: "border-red-200 bg-red-50/80 dark:border-red-900/70 dark:bg-red-950/25",
    text: "text-red-700 dark:text-red-300",
  },
  {
    key: "purple",
    label: "Purple",
    dot: "bg-purple-500",
    fill: "bg-purple-400/80 dark:bg-purple-500/75",
    panel: "border-purple-200 bg-purple-50/80 dark:border-purple-900/70 dark:bg-purple-950/25",
    text: "text-purple-700 dark:text-purple-300",
  },
  {
    key: "green",
    label: "Green",
    dot: "bg-green-600",
    fill: "bg-green-400/80 dark:bg-green-500/75",
    panel: "border-green-200 bg-green-50/80 dark:border-green-900/70 dark:bg-green-950/25",
    text: "text-green-700 dark:text-green-300",
  },
] as const;

export const employeeColorKeys = employeeColors.map((color) => color.key) as [
  (typeof employeeColors)[number]["key"],
  ...(typeof employeeColors)[number]["key"][],
];

export type EmployeeAccent = (typeof employeeColors)[number];
export type EmployeeColorKey = EmployeeAccent["key"];

export function getEmployeeAccent(accentColor?: string | null, employeeId = ""): EmployeeAccent {
  const selected = employeeColors.find((color) => color.key === accentColor);
  if (selected) return selected;

  let hash = 0;
  for (const character of employeeId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return employeeColors[hash % employeeColors.length];
}

export function getLeastUsedEmployeeColor(colors: Array<string | null | undefined>): EmployeeColorKey {
  const usage = new Map<EmployeeColorKey, number>(employeeColorKeys.map((key) => [key, 0]));
  for (const color of colors) {
    if (employeeColorKeys.includes(color as EmployeeColorKey)) {
      const key = color as EmployeeColorKey;
      usage.set(key, (usage.get(key) ?? 0) + 1);
    }
  }

  return employeeColorKeys.reduce((leastUsed, key) =>
    (usage.get(key) ?? 0) < (usage.get(leastUsed) ?? 0) ? key : leastUsed,
  );
}
