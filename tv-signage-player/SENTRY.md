# Crash reporting (TV player)

Off by default. The app sends nothing anywhere until a DSN is configured —
an empty DSN disables the Sentry SDK outright, so it never initialises.

## Turning it on

Create a project at sentry.io, then add its DSN to `tv-signage-player/.env`:

```
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
SENTRY_ENVIRONMENT=production
```

`.env` is not in git. CI can set the same two as environment variables
instead. The DSN is not a secret — it ships inside the APK and anyone who
unpacks one can read it.

## What this adds over what was already there

`CrashReportingHandler` posts stack traces to each screen's own Device Logs,
and still does. That is what you look at for one TV. This is the other half:
every TV's crashes in one place, grouped, so one fault across forty screens
reads as one problem instead of forty log rows nobody is watching.

It also covers four things the existing handler structurally cannot:

- **Startup crashes.** The old handler installs itself in
  `MainActivity.onCreate`, so anything that failed earlier — app startup,
  ContentProvider init, class init — happened before it existed. Sentry starts
  from its own ContentProvider, ahead of `Application.onCreate`.
- **ANRs.** A TV that locks up and shows a frozen frame never throws anything
  for an exception handler to catch. This is the complaint that actually comes
  in, and it was invisible.
- **Native crashes** in the WebRTC and media libraries.
- **Unpaired TVs.** The old handler returns early when there is no screenId,
  so a crash before pairing left no trace at all.

## What is not sent

- `send-default-pii` is false: no IP address, no device name
- No screenshots and no view hierarchy
- No performance tracing (sample rate 0)
- Never the owner's email or the server URLs

Reports are tagged with `screenId` and `hardwareUuid` once the screen's config
has loaded (see `util/ErrorReporting.kt`), which is enough to find the TV in
the dashboard and means nothing to anyone else. A crash during startup arrives
without those tags, because there was nothing loaded yet to tag it with.
