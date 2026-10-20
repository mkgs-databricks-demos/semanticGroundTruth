const REDACT_PATTERN = /token|secret|authorization|password/i;

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  msg: string;
  ts: string;
  [key: string]: unknown;
}

function redact(meta: object): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    result[key] = REDACT_PATTERN.test(key) ? '[REDACTED]' : value;
  }
  return result;
}

function write(level: LogLevel, msg: string, meta?: object): void {
  const entry: LogEntry = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...(meta ? redact(meta) : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info(msg: string, meta?: object): void {
    write('info', msg, meta);
  },
  warn(msg: string, meta?: object): void {
    write('warn', msg, meta);
  },
  error(msg: string, meta?: object): void {
    write('error', msg, meta);
  },
};
