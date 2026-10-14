# Atelier studio guide

[← Back to Atelier](../README.md)

Use **Browse paintings** in the header to explore the studio collection. Select a thumbnail or **View finished** for a large finished view; **Replay** opens that painting with its saved strokes, notes, and camera moves. You can switch paintings during playback without shortening their stored replay histories. The five existing studies are included; future paintings are saved automatically in this browser as marks and notes are completed. JSON downloads remain the portable backup. The gallery reports when browser storage is unavailable or full.

The working surface is warm primed linen with crossing woven threads and a subtle stretched-canvas edge. Unpainted and thinly painted areas show the weave; opaque paint covers it. The material texture is rendered into PNG exports. Historical finished previews retain their original paint and are presented on a linen surface in the gallery.

A local, agent-driven paint studio. Run `npm run dev`, open http://127.0.0.1:5173, and draw with a mouse, touch, or pressure-sensitive pen. No package installation required. Run `npm test` and `npm run check` for validation.

Six media share a CPU surface simulation with separate suspended watercolor and wet oil fields. Watercolor advects with capillary water flow over uneven paper, absorbs into the sheet, and settles with granulation, and can be reactivated by clean water. Oil is displaced in the direction of the brush, mixes through a three-band Kubelka–Munk approximation, and builds bristle ridges shaded by surface normals and wet highlights. Acrylic covers and dries quickly; pastel, chalk, and pencil deposit pressure-dependent dry marks. These remain experimental approximations, not validated fluid dynamics or full spectral paint chemistry. The paper type is currently fixed. The engine runs at 900 × 620 and may be slow on older devices.

## The studio companion

The on-screen companion shares short observations, experiments, lessons, and decisions to keep a mark. The current pigment, brush size, paint load, animated brush contact, and camera view remain visible beside the commentary. Replay/pause/stop/speed controls are also available beside the companion while the larger controls remain below the canvas.

**Guided flower session** opens the first narrated replay: 34 marks and 24 studio moments. Its teaching notes were adapted from the public commentary during the original live flower painting, and its camera focuses recreate the inspected areas. This existing session was annotated afterward. New live notes and meaningful whole/close/pan changes are recorded as they happen and survive export and refresh.

Use **Leave a thought at the easel** to publish a note with its purpose and camera focus. The **studio notebook** keeps the moments. **Include studio notes & camera moments** selects guided or brush-only replay. Optional **Read notes aloud** uses the browser/device’s normal voice when available; it is off by default.

Version 2 JSON sessions add `events` to the existing stroke history. Each event has `afterStroke`, optional `text`/`title`/`kind`, `duration` in milliseconds, and an optional `camera: {zoom, x, y}`. `kind` is `notice`, `try`, `learn`, `keep`, or `look`. Camera zoom is 1–3; focus coordinates are normalized. Events at the same boundary retain their order. Inspection time holds fluid and drying, and the camera moves smoothly to its focus; replay speed changes viewing time without changing the physical painting result. Pause freezes guided commentary and automatic camera movement as well as paint. Manual whole/close views and panning remain available for inspection while paused; stop cancels remaining moments.

For future live agent sessions, put the public observation in the browser before choosing the next batch:

```js
window.atelier.comment({
  kind: 'notice',
  text: 'The wash softened the left edge. Let’s keep it and sharpen the next one.',
  camera: {zoom: 2, x: .4, y: .5}
});
await window.atelier.paint(nextFewStrokes);
```

`comment` anchors a moment at the currently completed mark count. A `paint` call can also accept a complete version 2 session; event boundaries are relative to that incoming batch. The visible score editor accepts the same object or a legacy stroke array. `getDocument()` and JSON downloads include strokes and studio moments. During playback, saving retains the complete source so a refresh can restart an interrupted replay. Legacy version 1 sessions and old stroke arrays still open.

## Agent painting

Use the visible **Agent controls & stroke score** panel to submit JSON and watch it animate. Browser agents can fill the editor, click **Play stroke score**, and take screenshots to evaluate the result. Alternatively, a browser integration with script execution can call:

```js
await window.atelier.paint([
  {medium:'watercolor',color:'#315b70',size:30,flow:.7,tip:'round',duration:1800,
   points:[[.1,.5,.3],[.4,.3,.8],[.8,.5,.2]]}
]);
window.atelier.getState();
```

Coordinates and pressure are normalized from 0 to 1; size is in surface pixels. Optional `water` and `body` (0–1) control watercolor moisture and oil thickness. `flow: 0` with `water: 1` makes a clean-water watercolor stroke. `wait` delays a stroke in milliseconds, letting previous washes settle. Strokes execute sequentially. `paint` returns a promise that resolves on completion or cancellation. Also available: `replay`, `clear`, `stop`, `pause`, `resume`, and `getSession`. Pause freezes both playback and physics. Stop keeps the partially painted stroke. New canvas cancels playback. Undo restores physical fields within a 128 MiB memory budget (two checkpoints at the current resolution).

**Whole painting** and **Close view** switch between composition and zoomed surface inspection; the close view can be scrolled. **Review rhythm** optionally pauses after 3, 5, or 10 completed marks. Both physics and playback freeze at a review pause, and **Continue painting** advances the next batch. This supports frequent visual feedback while an agent paints.

**Replay painting** clears the canvas and replays all recorded strokes. Replay starts at 1×; choose 0.5×, 1×, 1.5×, 2×, or 4× to change viewing speed. Recorded note durations are preserved in exports, but replay gives each note about 300 milliseconds per word plus two seconds to settle in, with a four-second minimum (before speed scaling). Short recorded durations do not cut off reading time. Camera-only moments stay at 0.65 seconds. Comments stay visible during the next strokes and remain in the notebook. Camera transitions take 0.5 seconds before speed scaling. Read notes aloud allows spoken comments to finish before advancing. A fixed 30 Hz timeline interleaves deposition and 10 Hz fluid evolution, so a score reconstructs the same physical fields at completion across frame rates and viewing speeds. The simulation continues drying after completion. Replay excludes unrecorded thinking time between separate batches and reconstructs manual marks from recorded path samples. PNG export captures the current view; JSON export saves the score, not an exact physical snapshot. Browser storage retains the last completed score; after refresh, press Replay painting to reconstruct it. Downloads still work when browser storage is unavailable.

The studio keeps replay, notebook, and stroke controls below the canvas. The former “Paint with a partner” prompt area has been removed. Creative agents compose the next few marks directly through the score controls, inspect whole and close views, and continue through development and refinement. Existing handcrafted compositions remain available as recorded paintings. The harbor study contains 341 animated strokes and takes about two minutes at normal speed, with waterfront architecture, a lighthouse, a sailboat, reflections, a timber pier, and foreground flowers.

`examples/quiet-coast.json` contains the first 75-stroke browser-painted study: 57 initial watercolor/pencil strokes followed by 18 screenshot-guided marks that strengthen the boat, birds, and shoreline. Import it through the agent panel to watch the painting replay.

`examples/harbor-study.json` contains the detailed 348-stroke harbor session: the 341-stroke foundation followed by seven refinements made with close and whole-view inspection between small batches. Choose Continuous for an uninterrupted replay, or a review rhythm to examine each batch.

`examples/afternoon-flowers.json` records a new still life painted from blank paper in 34 strokes. Its next 1–3 marks were selected after whole-view and close-up screenshots, across 12 review rounds. The finished history was exported afterward for replay; there was no complete score prepared in advance. Watercolor washes and foliage, oil petals and a glaze highlight, chalk, and a pencil vein were combined as the painting developed.

`examples/where-the-evening-goes.json` records an original dusk sailboat study made in eleven three-stroke batches. Each next batch followed whole-view and close-up screenshot inspection. Its 12 teaching notes were posted live in the browser, and its 23 camera moments include whole views, close views, and a foreground pan. Import this session with **Include studio notes & camera moments** enabled to watch the decisions and inspections unfold with the painting.

`examples/copper-and-pears.json` records a 57-stroke oil still life, with 17 live teaching notes and 29 camera moments. Batches of 3–4 strokes were selected after close and whole-view screenshots. The study exposed excessive mixing through buried paint: the oil model was corrected after stroke 18, then those existing marks were rebuilt before painting continued. Replay uses the corrected model throughout; the early notes describe the original experiment, and the notes at stroke 18 explain the rebuild. Creation metadata records both Git revisions.

Oil now tracks an optical surface color separately from conserved pigment through depth. Fresh opaque paint can cover buried pigment, while thin strokes and wet brush pickup still mix exposed colors. Thick, loaded brushes retain more fresh color than thin brushes. This is an approximation, and bristle texture remains more regular than real paint.

## Verification

The automated tests cover distinct media deposition, capillary transport beyond the initial brush footprint, conservation of pigment and oil relief, separation of suspended and anchored colors, absorption and settling, clean-water strokes and rewetting, brush-driven oil displacement, subtractive mixing, body-dependent ridges, drying, state restoration, score validation, cancellation, and exact physical replay across frame rates. Browser checks exercised custom watercolor/oil scores, cross-stroke mixing, replay, pause/resume, changed viewing speed, saved-score recovery after refresh, automatic three-mark review pauses with whole/close inspection, narrated replay with camera choreography, live note publication with camera focus, and export of those moments, in addition to the earlier six-media, undo, stop, validation, and export checks.

The narration tests also cover legacy import compatibility, note and camera validation, boundary ordering, exact camera focus, cancellation, and all 24 flower-session moments. The narrated and brush-only replays produce identical physical fields at completion in the test simulation.

## Next realism milestones

- Full pigment-specific spectral absorption and scattering, and distinct cured oil layers.
- Calibrated paper fibers, capillary backruns, and evaporation-driven edge rings.
- Individual bristle dynamics, calibrated viscosity, and conservative brush-reservoir exchange.
- GPU simulation, high-resolution tiled surfaces, and exact physical-session snapshots.

Each medium's `spread` controls its mobile pigment fraction. Suspended pigment has its own color field so water transport never borrows color from underlying dry marks or oil. Oil surface displacement conserves its mass, absorption, color, and relief. Each stroke also has a brush reservoir that gradually depletes and picks up wet color across its contact patch. Reservoir pickup still approximates color exchange without removing pigment from the surface. The oil optical model uses three RGB bands, not measured spectra, and aggregates the oil layer rather than resolving every cured coat. Surface fluid flow is a bounded pairwise approximation, not a Navier–Stokes solver.

## Painting from a new chat

The reusable `skills/atelier` skill is installed as a personal skill on this machine through `~/.agents/skills/atelier`. Use `$atelier a rainy street at night`, or `$atelier` to let the agent find inspiration and choose a subject. `/atelier …` is an instruction alias, not a guaranteed built-in slash command. Codex discovers local skill changes automatically; restart if it does not appear. The skill locates this checkout, reads the practice journal, paints in small screenshot-guided batches, and records observations and camera moves.

The owner's standing preference is to publish completed Atelier paintings to GitHub and the public gallery, unless a session says local only or not to publish. See `PUBLISHING.md`. A publication is reported separately for GitHub, Sites, and custom DNS.

## Public viewing site

`public-gallery/` is a separate, read-only gallery: finished images, recorded replay, a project explainer, and a practice journal. `npm run gallery:build` creates `dist/` and a downloadable MIT source archive, excluding studio controls from the deployed UI. Each published work snapshots its replay engine so later physics edits cannot silently rewrite its process. The existing Sites project is identified in `.openai/hosting.json`; reuse it for all future releases.

## Evidence of practice

`practice/studies.json` holds concrete observations, evidence paths, renderer context, next experiments, and human ratings when supplied. `practice/LEARNING.md` defines comparisons and repeatable calibration studies. This is external memory and practice, not model retraining. Initial entries are explicitly retrospective baselines.
