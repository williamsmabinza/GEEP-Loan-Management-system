import fs from 'fs';
import path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'audit' | 'http';

class Logger {
  private logFilePath: string | null = process.env.LOG_FILE_PATH || null;

  private writeToFile(line: string) {
    if (!this.logFilePath) return;
    try {
      fs.appendFile(this.logFilePath, line + '\n', () => {});
    } catch {
      // Graceful fallback if file not writable
    }
  }

  debug(message: string, meta?: unknown) {
    if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
      const line = `[DEBUG] ${new Date().toISOString()} - ${message} ${meta ? JSON.stringify(meta) : ''}`;
      console.debug(line);
      this.writeToFile(line);
    }
  }

  info(message: string, meta?: unknown) {
    const line = `[INFO]  ${new Date().toISOString()} - ${message} ${meta ? JSON.stringify(meta) : ''}`;
    console.info(line);
    this.writeToFile(line);
  }

  warn(message: string, meta?: unknown) {
    const line = `[WARN]  ${new Date().toISOString()} - ${message} ${meta ? JSON.stringify(meta) : ''}`;
    console.warn(line);
    this.writeToFile(line);
  }

  error(message: string, error?: unknown) {
    const line = `[ERROR] ${new Date().toISOString()} - ${message} ${error ? (error instanceof Error ? error.stack : JSON.stringify(error)) : ''}`;
    console.error(line);
    this.writeToFile(line);
  }

  audit(action: string, actor: string, details?: unknown) {
    const line = `[AUDIT] ${new Date().toISOString()} - [${action}] by [${actor}] ${details ? JSON.stringify(details) : ''}`;
    console.info(line);
    this.writeToFile(line);
  }

  http(method: string, pathUrl: string, status: number, durationMs: number) {
    const line = `[HTTP]  ${new Date().toISOString()} - ${method} ${pathUrl} ${status} - ${durationMs.toFixed(2)}ms`;
    console.log(line);
    this.writeToFile(line);
  }
}

export const logger = new Logger();
