export type PeriodBounds = {
  period: string;
  from: Date;
  to: Date;
};

const periodPattern = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const parseArgentinaMonthPeriod = (period: string): PeriodBounds | null => {
  const match = periodPattern.exec(period);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return null;
  }
  const from = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0, 0));
  const to = new Date(Date.UTC(year, month, 1, 3, 0, 0, 0));
  return { period, from, to };
};

export const previousPeriod = (period: string): string | null => {
  const parsed = parseArgentinaMonthPeriod(period);
  if (!parsed) {
    return null;
  }
  const year = parsed.from.getUTCFullYear();
  const monthIndex = parsed.from.getUTCMonth();
  const previous = new Date(Date.UTC(year, monthIndex - 1, 1, 3, 0, 0, 0));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
};

export const periodsBetween = (fromPeriod: string, toPeriod: string): string[] => {
  const from = parseArgentinaMonthPeriod(fromPeriod);
  const to = parseArgentinaMonthPeriod(toPeriod);
  if (!from || !to || from.from > to.from) {
    return [];
  }
  const periods: string[] = [];
  const cursor = new Date(from.from);
  while (cursor <= to.from) {
    periods.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return periods;
};
