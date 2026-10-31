import { z } from "zod";

export const inventoryOptionTypeSchema = z.enum(["category", "location"]);
export type InventoryOptionType = z.infer<typeof inventoryOptionTypeSchema>;
export const inventoryOptionNameSchema = z
  .string()
  .transform((value) => value.normalize("NFC").trim().replace(/\s+/gu, " "))
  .pipe(z.string().min(1, "Enter a name.").max(100, "Use at most 100 characters."));
export function inventoryOptionName(kind: InventoryOptionType, value: unknown) {
  const name = inventoryOptionNameSchema.parse(value);
  const reserved = kind === "category" ? "Uncategorized" : "Unassigned";
  if (name.toLowerCase() === reserved.toLowerCase())
    throw new z.ZodError([
      { code: "custom", path: [], message: `${reserved} is a built-in option. Choose another name.` },
    ]);
  return name;
}
export type InventoryOptionSummary = {
  id: string;
  name: string;
  updatedAt: string;
  recordCount: number;
  productCount: number;
  archivedCount: number;
  available: number;
  reserved: number;
};
