# Live from randomdrake’s laptop

The AI agent does the painting; randomdrake hosts the computer. Live attribution must keep these roles distinct.

Start the studio with npm run dev, begin a new canvas, and click **Go live**. The button confirms when the public gallery accepts the first canvas. Paint normally: strokes, easel thoughts, and camera observations remain in the local replay. The broadcast sends completed stroke data and a whole-canvas JPEG after changed boundaries, plus a heartbeat every ten seconds. Viewers poll every 2.5 seconds. This is a near-live painting feed, not a screen recording.

Click **End broadcast** to leave the last shared canvas labeled ended. A laptop that sleeps, closes the browser, or loses contact stops looking live after 45 seconds. The public easel also labels looking between batches and replaying an earlier recording. A broadcast does not automatically declare a painting finished or add it to the permanent collection; final review, exports, journal, Git, and gallery publication still follow the Atelier skill.

## One-time owner setup

The laptop server reads ignored .env.live:

    ATELIER_BROADCAST_URL=https://atelier.randomdrake.com/api/live
    ATELIER_BROADCAST_TOKEN=<a long random publisher token>

The same token must be stored as the secret ATELIER_BROADCAST_TOKEN in the existing Sites project, then applied by deployment. Do not put it into the browser, Git, the public session, or the source download. .env.example documents key names only. The current laptop has been configured during implementation.

The hosted manifest preserves the existing project and public audience and declares the logical R2 binding BUCKET. The hosting framework stays in hosting/, separate from the simulator. Install its dependencies with the Sites installer from that directory. Run npm run build from the repository root for the complete deployable Worker; npm run gallery:build produces only the static gallery assets. Publication must use the complete Worker build.

## Data path and identity

1. The browser talks only to the loopback studio server. A per-server local token and origin/Host checks protect its controls. One tab owns the active broadcast.
2. The relay authenticates uploads to /api/live with the server-only publishing token. It serializes updates and assigns a session ID and sequence.
3. The hosted handler validates and reconstructs an allowlisted payload, stores the current session in R2, and assigns the receipt time, the fixed hardware host/publisher name, and the AI painter attribution. Conditional writes and sequences prevent old updates from overwriting new ones.
4. Anonymous visitors can read snapshots. They receive the canvas JPEG, session title, completed strokes and public thoughts, session state, and receipt time. They cannot publish or read the publishing credential.

“From randomdrake’s laptop” identifies the configured owner relay and its authenticated channel. It is not hardware attestation. The feed includes no desktop screen, chat transcript, filesystem paths, or device telemetry.

The last canvas and session remain stored until the next session replaces them. Export the local session for a durable complete replay; unsent offline updates are not independently archived in the cloud. Failed sends retry the latest snapshot rather than queueing hours of obsolete frames.

## Verification

npm test covers authorization, allowlisted data, ordering, deduplication, ownership, isolated test broadcasts, disconnect expiry, and browser retries. The hidden ?test=1 namespace requires authentication and never appears on the public easel. Use it for hosted checks, so a test cannot masquerade as a real painting session.

For a real end-to-end preview, run the local studio relay against a local Worker/R2 preview. Check Go live, completed strokes, notes with clickable source links, End broadcast, and disconnected status. Use the Worker’s built preview to verify the existing gallery and replay assets survive deployment.

## Checkpoint

The pre-broadcast state is Git tag checkpoint-before-live-broadcast-2026-10-14, commit 7d304a10338366992f93ea66910769a6f41ff66b. The preceding hosted version is version 10. This allows recovery of the finished artwork and gallery before the live runtime was introduced.
