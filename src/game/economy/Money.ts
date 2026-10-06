export function assertVnd(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('VND must be a nonnegative safe integer');
}

export function addVnd(a: number, b: number): number {
  assertVnd(a); assertVnd(b);
  const total = a + b;
  assertVnd(total);
  return total;
}

const formatter = new Intl.NumberFormat('vi-VN');
export function formatVnd(value: number): string { assertVnd(value); return `${formatter.format(value)}đ`; }
export function formatSignedVnd(value: number): string { assertVnd(Math.abs(value)); return `${formatter.format(value)}đ`; }
