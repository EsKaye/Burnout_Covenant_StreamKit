import pino from 'pino';

// Centralized structured logger. Log level adjustable via env.
export const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
