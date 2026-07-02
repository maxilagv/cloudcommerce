const orderNumberPattern = /^ORD-(\d{4})-(\d{6})$/;

export const formatOrderNumber = (year: number, sequence: number): string =>
  `ORD-${String(year).padStart(4, "0")}-${String(sequence).padStart(6, "0")}`;

export const parseOrderNumber = (value: string): { year: number; sequence: number } | null => {
  const match = orderNumberPattern.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const sequence = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(sequence)) {
    return null;
  }
  return { year, sequence };
};
