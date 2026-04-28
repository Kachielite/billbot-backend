import winston from 'winston';
import path from 'path';

const { combine, colorize, label, timestamp, printf, errors, json } = winston.format;

const logDir = path.join(process.cwd(), 'logs');
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Console format — mirrors the example pattern:
 *   colorize → label → timestamp → printf
 *
 * Output: [10:30:01] BillBot 🚀  info  Server started on port 3000
 *
 * Note: colorize() mutates info.level in place so it carries ANSI codes into
 * printf. We do NOT call .toUpperCase() or .padEnd() on the colorized level
 * because ANSI escape sequences throw off string-length calculations.
 */
const consoleFormat = combine(
  colorize({ level: true }),
  label({ label: 'BillBot 🚀' }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, label: lbl, timestamp: ts, stack }) => {
    const body = stack ? `${String(message)}\n${String(stack)}` : String(message);
    return `[${ts}] ${lbl}  ${level}  ${body}`;
  }),
);

/**
 * File format — structured JSON for log aggregators.
 * Level names are plain (no ANSI), timestamps are ISO 8601.
 */
const fileFormat = combine(
  label({ label: 'BillBot' }),
  timestamp(),
  errors({ stack: true }),
  json(),
);

const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console({
      level: isProduction ? 'info' : 'debug',
      format: consoleFormat,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
    }),
  ],
});

export default logger;
