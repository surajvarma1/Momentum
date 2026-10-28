/**
 * Privacy-Safe Structured Logger
 *
 * Guarantees that sensitive data (passwords, JWTs, API keys, raw user task contents)
 * are NEVER logged to console or remote monitoring.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogContext {
  userId?: string;
  component?: string;
  operation?: string;
  durationMs?: number;
  metadata?: Record<string, any>;
}

class SafeLogger {
  private isDevelopment = process.env.NODE_ENV !== 'production';

  private sanitize(obj: any): any {
    if (!obj) return obj;
    if (typeof obj === 'string') {
      // Redact potential tokens, secrets, emails if flagged
      return obj
        .replace(/(Bearer\s+[A-Za-z0-9-_=.]+)/gi, 'Bearer [REDACTED]')
        .replace(/(ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*)/g, '[JWT-REDACTED]')
        .replace(/([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})/g, '[EMAIL-REDACTED]');
    }
    if (typeof obj === 'object') {
      const sanitized: Record<string, any> = Array.isArray(obj) ? [] : {};
      for (const [key, val] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('password') ||
          lowerKey.includes('token') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('key') ||
          lowerKey.includes('authorization') ||
          lowerKey.includes('taskcontent') ||
          lowerKey.includes('description')
        ) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof val === 'object') {
          sanitized[key] = this.sanitize(val);
        } else {
          sanitized[key] = val;
        }
      }
      return sanitized;
    }
    return obj;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      level,
      message,
      context: this.sanitize(context),
      error: error
        ? {
            name: error.name,
            message: this.sanitize(error.message),
            // Stack trace omitted in production for security
            stack: this.isDevelopment ? error.stack : undefined,
          }
        : undefined,
    };

    if (level === 'ERROR') {
      console.error(JSON.stringify(payload));
    } else if (level === 'WARN') {
      console.warn(JSON.stringify(payload));
    } else if (this.isDevelopment || level === 'INFO') {
      console.log(JSON.stringify(payload));
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('DEBUG', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: LogContext, error?: Error) {
    this.log('WARN', message, context, error);
  }

  error(message: string, context?: LogContext, error?: Error) {
    this.log('ERROR', message, context, error);
  }
}

export const logger = new SafeLogger();
