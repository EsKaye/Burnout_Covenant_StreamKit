# Burnout Covenant StreamKit

Toolkit integrating Twitch streaming data for channel operations. Core capabilities:

- Fetch live stream information via the Helix API
- Register Webhook/EventSub subscriptions for real-time triggers
- EventSub subscriptions persist to disk and auto-renew for always-on coverage
- Resilient HTTP layer with rate limiting and automatic retries
- Chat bot powered by tmi.js with command throttling and role-based access
- Structured logging and OpenTelemetry metrics

## Setup

1. Install dependencies: `npm install`.
2. Copy `.env.example` to `.env` and supply required variables:
   - `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` from your Twitch developer application.
   - Optional extras enable advanced features:
     - `TWITCH_STREAMER` defaults to `SolarKhan`.
     - `TWITCH_EVENTSUB_CALLBACK`, `TWITCH_EVENTSUB_SECRET` and `TWITCH_BROADCASTER_ID` enable EventSub webhooks.
     - `TWITCH_CHAT_USERNAME`, `TWITCH_CHAT_TOKEN` and `TWITCH_CHAT_CHANNELS` enable the chat bot.
     - `EVENTSUB_STATE_FILE` sets where subscription state is stored (defaults to `eventsub-state.json`).
     - `LOG_LEVEL` controls structured logging verbosity.
3. Build the project: `npm run build`.
4. Execute the sample script: `npm start`.

## Tests

Run `npm test` for environment validation and regression coverage of the Twitch client, chat bot, and EventSub manager.
