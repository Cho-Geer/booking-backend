export function resolveJwtExpiresIn(value: string | number | undefined, fallback: string | number = 3600): string | number {
  const resolved = value ?? fallback;

  if (typeof resolved === 'number' && Number.isFinite(resolved)) {
    return resolved;
  }

  if (typeof resolved !== 'string') {
    return fallback;
  }

  const normalized = resolved.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  const numericValue = Number(normalized);
  if (!Number.isNaN(numericValue)) {
    return numericValue;
  }

  return normalized;
}
