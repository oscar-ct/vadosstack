export type JobMaterial = {
  description: string;
  type?: "purchase" | "return";
  vendor?: string;
  purchaseDate?: string;
  quantity: string;
  unit?: string;
  unitPrice: string;
  price: string;
};

export function calculateMaterialTotal(material: Pick<JobMaterial, "quantity" | "unitPrice" | "price">) {
  const explicitPrice = material.price.trim();
  if (explicitPrice) {
    const price = Number(explicitPrice);
    return Number.isFinite(price) ? price.toFixed(2) : "0.00";
  }

  const quantity = Number(material.quantity || 0);
  const unitPrice = Number(material.unitPrice || 0);
  const total = quantity > 0 && unitPrice > 0 ? quantity * unitPrice : 0;

  return Number.isFinite(total) ? total.toFixed(2) : "0.00";
}

export function calculateSignedMaterialTotal(material: Pick<JobMaterial, "quantity" | "unitPrice" | "price" | "type">) {
  const total = Number(calculateMaterialTotal(material));
  const signedTotal = material.type === "return" ? -total : total;

  return Number.isFinite(signedTotal) ? signedTotal.toFixed(2) : "0.00";
}

export function parseMaterials(value: string | null | undefined): JobMaterial[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        const description = typeof item?.description === "string" ? item.description : "";
        const type: JobMaterial["type"] = item?.type === "return" ? "return" : "purchase";
        const vendor = typeof item?.vendor === "string" ? item.vendor : "";
        const purchaseDate = typeof item?.purchaseDate === "string" ? item.purchaseDate : "";
        const quantity =
          typeof item?.quantity === "string"
            ? item.quantity
            : item?.quantity === undefined
              ? ""
              : String(item.quantity);
        const unitPrice =
          typeof item?.unitPrice === "string"
            ? item.unitPrice
            : item?.unitPrice === undefined
              ? item?.quantity === undefined
                ? ""
                : String(item?.price ?? "")
              : String(item.unitPrice);
        const unit = typeof item?.unit === "string" ? item.unit : "";
        const price =
          typeof item?.price === "string"
            ? item.price
            : item?.price === undefined
              ? calculateMaterialTotal({ quantity, unitPrice, price: "" })
              : String(item.price);

        return {
          description,
          type,
          vendor,
          purchaseDate,
          quantity,
          unit,
          unitPrice,
          price,
        };
      })
      .filter((item) => item.description || item.vendor || item.quantity || item.unit || item.unitPrice || item.price);
  } catch {
    return [];
  }
}

export function stringifyMaterials(materials: JobMaterial[]) {
  return JSON.stringify(
    materials
      .map((material) => ({
        description: material.description.trim(),
        type: material.type === "return" ? "return" : "purchase",
        vendor: material.vendor?.trim() ?? "",
        purchaseDate: material.purchaseDate?.trim() ?? "",
        quantity: material.quantity.trim(),
        unit: material.unit?.trim() ?? "",
        unitPrice: material.unitPrice.trim(),
        price: material.price.trim() || calculateMaterialTotal(material),
      }))
      .filter(
        (material) =>
          material.description ||
          material.vendor ||
          material.quantity ||
          material.unit ||
          material.unitPrice ||
          Number(material.price) !== 0,
      ),
  );
}
