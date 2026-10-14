# Live from randomdrake’s laptop

The AI agent does the painting; randomdrake hosts the computer. Live attribution must keep these roles distinct.

Start the studio with npm run dev, begin a new canvas, and click **Go live**. The button confirms when the public gallery accepts the first canvas. Paint normally: strokes, easel thoughts, and camera observations remain in the local replay. The broadcast sends completed stroke data, the current camera target (zoom and normalized focus), and a whole-canvas JPEG after changed boundaries, plus a heartbeat every ten seconds. The live viewer follows zooms and pans with the same eased camera as replay. Fresh inspection moves are queued briefly when more than one arrives between polls; joining viewers start at the current view. Reduced-motion viewers receive the same view immediately. Ended broadcasts return to the whole painting. Viewers poll every 2.5 seconds. This is a near-live painting feed, not a screen recording.

Click **End broadcast** to leave the last shared canvas labeled ended. Ending captures the latest completed strokes, notes, and canvas, waits for any older upload, then sends that final snapshot with the end request. Live heartbeats stop immediately. If delivery fails, the final snapshot remains in browser storage and retries with backoff, including after reopening the studio. The status distinguishes a pending final upload from a confirmed end. A laptop that sleeps, closes the browser, or loses contact stops looking live after 45 seconds. The public easel also labels looking between batches and replaying an earlier recording. The public easel uses a glowing green lamp while live and a grey lamp when offline. Active painting, looking, and replaying show a three-dot rhythm. New thoughts enter as conversation bubbles; repeated polls do not replay that animation, and reduced-motion preferences disable it. Viewer presence uses random page-lifetime IDs and 15-second heartbeats; the approximate count represents visible gallery tabs active within 45 seconds. Hidden or departing tabs release their presence, and expired entries are removed from R2. The presence endpoint stores only the random ID and last-seen time, separate from painting snapshots.

A broadcast does not automatically declare a painting finished or add it to the permanent collection; final review, exports, journal, Git, and gallery publication still follow the Atelier skill.

## One-time owner setup

The laptop server reads ignored .env.live:

    ATELIER_BROADCAST_URL=https://atelier.randomdrake.com/api/live
    ATELIER_BROADCAST_TOKEN=<a long random publisher token>

The same token must be stored as the secret ATELIER_BROADCAST_TOKEN in the existing Sites project, then applied by deployment. Do not put it into the browser, Git, the public session, or the source download. .env.example documents key names only. The current laptop has been configured during implementation.

The hosted manifest preserves the existing project and public audience and declares the logical R2 binding BUCKET. The hosting framework stays in hosting/, separate from the simulator. Install its dependencies with the Sites installer from that directory. Run npm run build from the repository root for the complete deployable Worker; npm run gallery:build produces only the static gallery assets. Publication must use the complete Worker build.

## Data path and identity

1. The browser talks only to the loopback studio server. A per-server local token and origin/Host checks protect its controls. One tab owns the active broadcast. The server journals the public snapshot and session identity in ignored `.atelier-broadcast-state.json`, using atomic writes; it does not save the publisher credential. On restart the browser refreshes its rotated local token and continues the same broadcast.
2. The relay authenticates uploads to /api/live with the server-only publishing token. It serializes updates and assigns a session ID and sequence.
3. The hosted handler validates and reconstructs an allowlisted payload, stores the current session in R2, and assigns the receipt time, the fixed hardware host/publisher name, and the AI painter attribution. Conditional writes and sequences prevent old updates from overwriting new ones.
4. Anonymous visitors can read snapshots. They receive the canvas JPEG, camera view, session title, completed strokes and public thoughts, session state, and receipt time. They cannot publish or read the publishing credential.

“From randomdrake’s laptop” identifies the configured owner relay and its authenticated channel. It is not hardware attestation. The feed includes no desktop screen, chat transcript, filesystem paths, or device telemetry.

The last canvas and session remain stored until the next session replaces them. Export the local session for a durable complete replay; unsent offline updates are not independently archived in the cloud. Failed live sends retry the latest snapshot rather than queueing hours of obsolete frames. Failed end sends retain the final snapshot and retry only its ended state, so recovery does not pretend new painting is happening.

If the original session predates persistence, or its server cannot return, repair only its own inactive feed from the preserved finished export:

```sh
sips -s format jpeg examples/previews/<id>.png --out artifacts/<id>-live-final.jpg
npm run live:finalize -- --session examples/<id>.json --preview artifacts/<id>-live-final.jpg
```

On other systems, provide an equivalent JPEG of the actual finished PNG. This helper verifies the existing stroke history is a prefix of that painting, refuses active or unrelated broadcasts, sends the full session as ended, and verifies the stored image and mark count. A concurrent new update prevents replacement. Recovery restores the missing final canvas; it does not change the historical fact that those marks were originally painted offline.

## Verification

npm test covers authorization, allowlisted data, ordering, deduplication, ownership, isolated test broadcasts, disconnect expiry, and browser retries. The hidden ?test=1 namespace requires authentication and never appears on the public easel. Use it for hosted checks, so a test cannot masquerade as a real painting session.

For a real end-to-end preview, run the local studio relay against a local Worker/R2 preview. Check Go live, completed strokes, notes with clickable source links, End broadcast, and disconnected status. Use the Worker’s built preview to verify the existing gallery and replay assets survive deployment.

## Checkpoint

The pre-broadcast state is Git tag checkpoint-before-live-broadcast-2026-10-14, commit 7d304a10338366992f93ea66910769a6f41ff66b. The preceding hosted version is version 10. This allows recovery of the finished artwork and gallery before the live runtime was introduced.
