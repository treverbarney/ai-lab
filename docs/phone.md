# Dino Lab — pocket studio

Dino Lab now includes an installable phone web app for iPhone and Android. The
phone controls the same host runtime used by the desktop workbench; it does not
try to run native CAD applications or full training on the phone.

## Connect from the desktop

1. Keep your computer awake and open Dino Lab.
2. Connect Tailscale on the computer and phone, using devices permitted to reach
   each other in your tailnet.
3. In Dino Lab desktop, open **Phone access** → **Enable phone access**.
4. Scan the QR code on the phone. The private pairing link signs in this device.
5. On iPhone, use Safari's Share → Add to Home Screen. On Android, use the browser's
   Install app / Add to Home screen option.

The app uses Tailscale Serve on HTTPS port 8443, forwarding to its loopback-only
phone server on port 4317. Tailscale must be signed in, running, and permitted to
serve HTTPS. If HTTPS needs administrator approval, complete the Tailscale setup
and retry the private-link button. Dino refuses to replace an existing unrelated
8443 service. Existing other ports and routes stay untouched.

If Tailscale is unavailable, the desktop can open a localhost preview, but that
localhost URL does not connect your phone. Use the private HTTPS link for actual
phone access and service-worker/offline support. No public Funnel is configured.

## What works on the phone

- **Studio:** eight Dino tool workspaces, hosted neural demos, host runtime installs,
  visualizer server controls, prepared CPU training and CAD/physics sample jobs.
- **Jobs:** current host job states, live logs, output and stop controls. Updates are
  pushed while the page is visible; backgrounding the page stops its live stream.
- **Files:** download artifacts from the host's `.dino/artifacts` folder.
- **MCP:** connect saved server definitions, inspect real tool schemas, run explicit
  calls and disconnect. Server executables/arguments can only be configured in
  the trusted desktop app. CAD calls may modify the open native design.
- **Native shortcuts:** launch the native app already configured on the host.
  Phone access never opens an executable picker remotely.
- **Guides:** read bundled docs without opening files on the host desktop.

Hosted neural demos execute in the phone browser and may use its CPU/GPU or load
models. Local neural visualizer servers start on the host; their local URLs are
not proxied to the phone. Use the hosted demo when viewing from your phone.

Training uses only the existing tiny CPU profile and dataset prepared on the
host. Dataset selection, full training configuration, runtime server settings,
repository selection and project bootstrap remain desktop actions.

## Pairing and offline behavior

The QR/private link contains a pairing secret in its URL fragment. The app removes
that fragment before signing in, then uses an HttpOnly, SameSite session cookie.
Keep the QR/key private. Sessions last up to seven days while that phone server
stays running. Stopping phone access revokes every session; restarting creates a
new key. **Unpair this phone** revokes that device when connected to the host.

The service worker caches only the public app shell, catalog, icons and manifest.
It never caches session APIs, live job output, pairing requests or artifact files.
Offline mode keeps navigation and hosted-demo links available. It does not claim
a job ran or queue modifying operations while disconnected.

The host must be awake, connected and running Dino phone access for local tools.
This build does not add wake-on-LAN, push notifications or a cloud relay.

## Terminal mode

`npm run phone:private` runs the same phone host without Electron and prints the
private pairing URL. `npm run phone` starts only a loopback preview. The CLI uses
the current repository and default adapter connections. Native app shortcuts use
the remembered desktop paths only when access is started in Dino desktop.

Choose the desktop host or standalone host, not both at once. Both use port 4317.
Ctrl+C shuts down the standalone phone server, owned jobs and its MCP connections.

## Validation

The phone HTTP tests cover pairing, session cookies, origin/host checks, restricted
actions, artifact containment, session revocation, installable assets and preserving
existing Tailscale services. Browser checks cover phone-sized navigation, pairing,
job actions, live output, artifact downloads and offline shell loading. Native iOS/
Android Home Screen installation and a real two-device Tailscale route still need
verification on those devices.
