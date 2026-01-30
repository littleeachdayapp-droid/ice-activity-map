type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatLog(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    // JSON format for production (easier to parse)
    return JSON.stringify(entry);
  }
  // Human-readable format for development
  const { timestamp, level, message, ...rest } = entry;
  const extras = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${extras}`;
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  };

  const formatted = formatLog(entry);

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => log('debug', message, data),
  info: (message: string, data?: Record<string, unknown>) => log('info', message, data),
  warn: (message: string, data?: Record<string, unknown>) => log('warn', message, data),
  error: (message: string, data?: Record<string, unknown>) => log('error', message, data),

  // Request logging helper
  request: (req: { method: string; url: string; ip?: string }, statusCode: number, durationMs: number) => {
    log('info', 'HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode,
      durationMs,
      ip: req.ip
    });
  }
};
