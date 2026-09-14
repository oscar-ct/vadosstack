export class TimeEntryUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeEntryUserError";
  }
}

export function getSafeTimeEntryErrorMessage(error: unknown, fallback: string, operation: string) {
  if (error instanceof TimeEntryUserError) return error.message;

  console.error(`[time-tracking] ${operation} failed`, error);
  return fallback;
}
