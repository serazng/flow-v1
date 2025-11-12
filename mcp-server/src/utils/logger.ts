/**
 * Simple logger utility for MCP server
 * Logs to stderr (stdout is used for MCP protocol)
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

class Logger {
  private level: LogLevel;

  constructor() {
    // Default to INFO level, can be overridden with MCP_LOG_LEVEL env var
    const envLevel = process.env.MCP_LOG_LEVEL?.toUpperCase();
    this.level = envLevel ? (LogLevel[envLevel as keyof typeof LogLevel] ?? LogLevel.INFO) : LogLevel.INFO;
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (level <= this.level) {
      const prefix = LogLevel[level];
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${prefix}] ${message}`;
      console.error(logMessage, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }
}

export const logger = new Logger();

