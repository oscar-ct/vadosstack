import { minorUnitsToDecimalMoney } from "./domain";

export type ApplicationFeeConfig = {
  basisPoints: number;
  fixedMinorUnits: number;
};

const BASIS_POINTS_ENV = "PAYMENT_APPLICATION_FEE_BASIS_POINTS";
const FIXED_CENTS_ENV = "PAYMENT_APPLICATION_FEE_FIXED_CENTS";

function parseNonNegativeInteger(name: string, value: string | undefined, maximum: number) {
  const normalized = value?.trim() || "0";
  if (!/^\d+$/.test(normalized)) throw new Error(`${name} must be a non-negative integer.`);

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new Error(`${name} must be between 0 and ${maximum}.`);
  }
  return parsed;
}

export function getApplicationFeeConfig(
  environment: Record<string, string | undefined> = process.env,
): ApplicationFeeConfig {
  return {
    basisPoints: parseNonNegativeInteger(BASIS_POINTS_ENV, environment[BASIS_POINTS_ENV], 10_000),
    fixedMinorUnits: parseNonNegativeInteger(FIXED_CENTS_ENV, environment[FIXED_CENTS_ENV], 99_999_999),
  };
}

export function calculateApplicationFeeMinorUnits(grossMinorUnits: number, config = getApplicationFeeConfig()) {
  if (!Number.isSafeInteger(grossMinorUnits) || grossMinorUnits <= 0) {
    throw new Error("Payment amount must be a positive safe integer in minor units.");
  }

  const percentageFee = Math.round((grossMinorUnits * config.basisPoints) / 10_000);
  const fee = percentageFee + config.fixedMinorUnits;
  if (!Number.isSafeInteger(fee) || fee < 0) throw new Error("Calculated application fee is invalid.");
  if (fee >= grossMinorUnits) throw new Error("Application fee must be less than the payment amount.");
  return fee;
}

export function calculateApplicationFeeDecimal(grossMinorUnits: number, config = getApplicationFeeConfig()) {
  return minorUnitsToDecimalMoney(calculateApplicationFeeMinorUnits(grossMinorUnits, config));
}
