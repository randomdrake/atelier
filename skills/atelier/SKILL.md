---
name: atelier
description: Paint creatively in the Atelier browser studio, inspect screenshots between small batches, record teaching and camera moves, and maintain a practice journal. Use for $atelier, /atelier, or requests to paint with Atelier; choose inspiration when no subject is given.
---

# Atelier

Attribution: the AI agent is the painter. randomdrake hosts the hardware and the public feed; do not describe him as painting or co-painting the work. Keep this distinction in live labels, notes, metadata, and summaries.

Treat the text following the invocation as the painting prompt. If none is supplied, choose an original subject, medium, and mood. `/atelier` is a natural-language alias understood by these instructions, not a guaranteed built-in slash command; `$atelier` is the explicit skill mention.

Find the project at `/Users/randomdrake/Code/ai-painting` on this machine. On another machine, use the current Atelier checkout or ask for its location. Read `README.md`, `practice/LEARNING.md`, the latest entries in `practice/studies.json`, and `PUBLISHING.md` if publication is requested. Use the files as durable memory instead of depending on an older chat. Check repository instructions and Git status before edits.

## Choose and begin

Follow the user's prompt, medium, and constraints. For an open-ended session, find a small source of inspiration in the wider world: weather, a landscape, an ordinary object, a scientific image, a story, or a museum's public-domain collection. Browse when seeking current or sourced inspiration. Record what sparked the idea and a source link when applicable; interpret it into an original subject rather than copying a finished composition. Choose one concrete practice goal from the journal, such as edge control, quieter highlights, or uneven bristle texture. State the subject and goal publicly.

Use the existing studio at `http://127.0.0.1:5173/` or start `npm run dev` in the checkout. Keep it visible when the user wants to watch. Use supported browser controls and actual screenshots. If computer use is unavailable, explain that limitation and preserve the plan; do not claim to have visually inspected the painting.

## Paint by looking

The owner prefers a sustained painting session. Spend substantially longer developing the painting than a quick sketch: a recognizable subject is the block-in, not the finish. Plan time for broad composition, form and color development, selective corrections, and a final refinement pass. A typical open-ended study may need a dozen or more inspection rounds; this is a guide to the depth of work, not a stroke quota. Honor an explicit request for a quick sketch.

Start a new canvas. If this laptop’s live broadcast is configured, use **Go live** before the opening note, and confirm **Live from this laptop**. A painting request authorizes sharing this painting’s canvas, completed strokes and public easel thoughts with the existing Atelier gallery. Honor “local only,” “don’t broadcast,” or other session restrictions. Broadcast controls distinguish recorded replay from new painting. Use **End broadcast** after the final review and confirm it ended with the final completed mark count before publishing the finished painting. If that final upload cannot be acknowledged, preserve the finished PNG and JSON before a reload; use the matching inactive-feed recovery workflow in `PUBLISHING.md`, and record the interruption truthfully. If the live connection fails, keep painting locally and report the broadcast limitation; never claim an offline session was live. Publish a short opening note through **Leave a thought at the easel**. Use **Agent controls & stroke score** to submit only the next 1–4 strokes. Finish the batch and wait until playback is idle. Inspect a settled whole-view screenshot and a settled close-up screenshot, then choose the next batch from what is actually visible. After each camera move, confirm the displayed zoom has reached its target before taking the inspection screenshot. Vary the batch size when a single uncertain mark deserves its own check. Do not prepare the entire score before these inspections.

Put observations, teaching, and the next experiment into the browser notebook as the work develops. Describe visible evidence, intent, and practical lessons; do not expose private reasoning or claim the notes are a transcript of it. Use whole/close camera buttons and pans after playback is idle so those movements record. Let animations settle before judging an edge. Keep this few-strokes / look / respond rhythm throughout the session, including the block-in, middle development, corrections, and final details. Do not switch to a long prewritten score to finish faster.

At each inspection, identify a visible relationship to develop: silhouette, proportion, value separation, color temperature, contact shadow, edge softness, material texture, or placement in the surrounding space. Choose the next small batch to address that relationship, then check whether the correction worked. Alternate stepping back for the composition with leaning in for paint handling. If a tentative mark is uncertain, submit it alone and inspect it before continuing.

Do not stop after a handful of batches merely because the subject reads. When an inspection reveals a fixable problem—an angular saucer, an unfilled shape, an overly weak highlight—try a focused correction and inspect the result instead of only recording the problem as a lesson. Work toward a coherent light structure, intentional edges, convincing forms, and a deliberate focal area; leave quiet passages where they serve the painting. Preserve useful irregularities instead of polishing every mark.

Before declaring the painting finished, make a deliberate whole-and-close review after the refinement pass. Revisit the stated practice goal and any unresolved visual problems. Continue with another small batch when it has a concrete purpose; stop when further marks are unlikely to help, and record why. Neither elapsed time nor a larger stroke count proves a painting is resolved.

The canvas is 900×620. Stroke points are normalized `[x,y,pressure]`; colors use six-digit hex. Sizes are 1–160 px. Oil `body` and `flow` range 0–1; `tip` is `round` or `flat`. Watercolor uses `water`. Typical stroke durations are 800–1500 ms. Read `docs/studio-guide.md` for current schemas and physics. Preserve animation and record every used medium; do not substitute image generation for painting with the simulator unless the user requests it.

If an experiment exposes a simulator issue, say so candidly. Capture the session before modifying physics, make a focused fix with meaningful regression tests, and record the engine change and any rebuild in the creation metadata. Re-rendered earlier marks may differ from their original screenshots; document that distinction.

## Finish and carry the lesson forward

Export the completed PNG and session JSON through the browser. Give the painting a title. Save replay history in `examples/<slug>.json` and an actual finished preview in `examples/previews/<slug>.png`, with creation metadata identifying inspection boundaries and live versus retrospective notes. Keep useful review screenshots under `artifacts/` and evidence paths in the practice entry.

Append a practice entry following `practice/LEARNING.md`: goal, observable outcome, failure or correction, evidence, engine/model context when known, and the next experiment. Keep human ratings unset until the user supplies them. Read old entries as hypotheses to test, not proof of improvement. Use Git to save the painting, observations, and any tested code changes.

The owner’s standing preference for this Atelier project is to publish completed paintings: an Atelier painting request explicitly authorizes committing the finished art and related project updates, pushing them directly to `main` in `git@github.com:randomdrake/atelier.git` with `git push origin HEAD:main`, and deploying the matching version to the existing public Atelier Site. Reconcile remote changes before a normal fast-forward push; never force-push. Honor “local only,” “don’t publish,” or other per-session restrictions. Use `PUBLISHING.md` and the available Sites workflow against the persisted project ID. Report GitHub push, Site deployment, and custom-domain verification separately; never claim an unavailable or failed step succeeded. Never change an existing site’s audience merely to deploy. This preference does not authorize unrelated messages, services, or publication of material outside the painting project.

End with the painting, its replay location, a short evidence-based lesson, and publication status if relevant. Distinguish a finished painting, a prepared gallery entry, a deployed site, and a custom domain awaiting DNS.
