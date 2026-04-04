export type StructuredLogLevel = 'log' | 'warn' | 'error';

export function writeStructuredLog(
  level: StructuredLogLevel,
  event: string,
  context: string,
  metadata: Record<string, unknown> = {},
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    context,
    ...metadata,
  };

  const message = JSON.stringify(entry);

  if (level === 'error') {
    console.error(message);
    return;
  }

  if (level === 'warn') {
    console.warn(message);
    return;
  }

  console.log(message);
}
