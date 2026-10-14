# Atelier

A local, agent-driven paint studio. Run `npm run dev`, open http://127.0.0.1:5173, and draw with a mouse, touch, or pressure-sensitive pen. No package installation required. Run `npm test` and `npm run check` for validation.

Six media share a CPU surface simulation with separate suspended watercolor and wet oil fields. Watercolor advects with capillary water flow over uneven paper, absorbs into the sheet, and settles with granulation. Oil is displaced in the direction of the brush, mixes through a three-band Kubelka–Munk approximation, and builds bristle ridges shaded by surface normals and wet highlights. Acrylic covers and dries quickly; pastel, chalk, and pencil deposit pressure-dependent dry marks. These remain experimental approximations, not validated fluid dynamics or full spectral paint chemistry. The paper type is currently fixed. The engine runs at 900 × 620 and may be slow on older devices.

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

**Replay painting** clears the canvas and replays all recorded strokes. Use 0.5×, 1×, 2×, or 4× to change viewing speed. A fixed 30 Hz timeline interleaves deposition and 10 Hz fluid evolution, so a score reconstructs the same physical fields at completion across frame rates and viewing speeds. The simulation continues drying after completion. Replay excludes unrecorded thinking time between separate batches and reconstructs manual marks from recorded path samples. PNG export captures the current view; JSON export saves the score, not an exact physical snapshot. Browser storage retains the last completed score; after refresh, press Replay painting to reconstruct it. Downloads still work when browser storage is unavailable.

The prompt button selects handcrafted harbor, coastal, floral, or abstract studies by keywords. It does not call an AI model. Creative agent compositions can supply arbitrary scores. This separation lets the agent inspect screenshots, choose its next marks, and work in small batches. The harbor study contains 340 animated strokes and takes about two minutes at normal speed, with waterfront architecture, a lighthouse, a sailboat, reflections, a timber pier, and foreground flowers.

`examples/quiet-coast.json` contains the first 75-stroke browser-painted study: 57 initial watercolor/pencil strokes followed by 18 screenshot-guided marks that strengthen the boat, birds, and shoreline. Import it through the agent panel to watch the painting replay.

## Verification

The 26 automated tests cover distinct media deposition, capillary transport beyond the initial brush footprint, conservation of pigment and oil relief, separation of suspended and anchored colors, absorption and settling, clean-water strokes, brush-driven oil displacement, subtractive mixing, body-dependent ridges, drying, state restoration, score validation, cancellation, and exact physical replay across frame rates. Browser checks exercised custom watercolor/oil scores, cross-stroke mixing, replay, pause/resume, and changed viewing speed, in addition to the earlier six-media, undo, stop, validation, and export checks.

## Next realism milestones

- Full pigment-specific spectral absorption and scattering, and distinct cured oil layers.
- Calibrated paper fibers, capillary backruns, and evaporation-driven edge rings.
- Individual bristle dynamics, calibrated viscosity, and conservative brush-reservoir exchange.
- GPU simulation, high-resolution tiled surfaces, and exact physical-session snapshots.

Each medium's `spread` controls its mobile pigment fraction. Suspended pigment has its own color field so water transport never borrows color from underlying dry marks or oil. Oil surface displacement conserves its mass, absorption, color, and relief. Each stroke also has a brush reservoir that gradually depletes and picks up wet color across its contact patch. Reservoir pickup still approximates color exchange without removing pigment from the surface. The oil optical model uses three RGB bands, not measured spectra, and aggregates the oil layer rather than resolving every cured coat. Surface fluid flow is a bounded pairwise approximation, not a Navier–Stokes solver.
