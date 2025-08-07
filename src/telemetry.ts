import { MeterProvider, PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';

// Setup a basic metric provider with console exporter for visibility during development.
const meterProvider = new MeterProvider({
  readers: [
    new PeriodicExportingMetricReader({
      exporter: new ConsoleMetricExporter(),
      exportIntervalMillis: 60000, // export every minute
    }),
  ],
});

export const meter = meterProvider.getMeter('streamkit');

// Counters capturing API usage and chat message throughput.
export const apiRequestCounter = meter.createCounter('twitch_api_requests', {
  description: 'Number of Twitch API requests made',
});

export const chatMessageCounter = meter.createCounter('chat_messages_processed', {
  description: 'Number of chat messages processed by the bot',
});
