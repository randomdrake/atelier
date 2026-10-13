# Atelier

A local, agent-driven paint studio. Run `npm run dev`, open http://127.0.0.1:5173, and draw with a mouse, touch, or pressure-sensitive pen. No package installation required. Run `npm test` and `npm run check` for validation.

Six media share a CPU pigment simulation but use distinct deposition, paper-grain, relief, wet mixing, and drying parameters. Watercolor has conservative pigment transport through wet paper; oil builds slow-drying relief; acrylic covers and dries quickly; pastel, chalk, and pencil deposit pressure-dependent dry marks. These are experimental approximations, not a validated fluid or chemically accurate paint model. The paper type is currently fixed. The engine runs at 900 × 620 and may be slow on older devices.

## Agent painting

Use the visible **Agent controls & stroke score** panel to submit JSON and watch it animate. Browser agents can fill the editor, click **Play stroke score**, and take screenshots to evaluate the result. Alternatively, a browser integration with script execution can call:

```js
await window.atelier.paint([
  {medium:'watercolor',color:'#315b70',size:30,flow:.7,tip:'round',duration:1800,
   points:[[.1,.5,.3],[.4,.3,.8],[.8,.5,.2]]}
]);
window.atelier.getState();
```

Coordinates and pressure are normalized from 0 to 1; size is in surface pixels. Strokes execute sequentially. `paint` returns a promise that resolves on completion or cancellation. Also available: `clear`, `stop`, `pause`, `resume`, and `getSession`. Pause freezes both playback and physics. Stop keeps the partially painted stroke. New canvas cancels playback. Undo restores the last stroke's physical fields (12 checkpoints). PNG export captures the current view; session export captures stroke instructions for animated replay, rather than an exact physical snapshot of drying time.

The prompt button selects handcrafted coastal, floral, or abstract studies by keywords. It does not call an AI model. Creative agent compositions can supply arbitrary scores. This separation lets the agent inspect screenshots, choose its next marks, and work in small batches.

## Verification

The 14 automated tests cover distinct media deposition, conservative wet transport, pigment settling, anchored dry marks, slow oil versus faster acrylic drying, boundary drying, state restoration, wet brush pickup, frame-independent stroke contacts, and score validation. Browser checks exercised all six media, custom score playback, pause/resume, stop, undo, rejected input, and a complete coastal painting. Export and replay are intended for iterative painting sessions; refreshing the page clears the live canvas, so download a session before leaving.

## Next realism milestones

- Pigment-specific spectral absorption and scattering; layered wet/dry pigment fields.
- Calibrated paper absorption, capillary blooms and evaporation edge deposits.
- Individual bristle dynamics, calibrated viscosity, and conservative wet paint pickup.
- GPU simulation, high-resolution tiled surfaces, and exact physical-session snapshots.

Each medium's `spread` controls its mobile pigment fraction. Water carries this fraction between neighboring cells; pigment settles more quickly at drier wash edges. Dry media and cured paint do not diffuse with water. Color transport still approximates the local pigment mixture rather than separating individual pigment species. Each stroke has a brush reservoir that gradually depletes and picks up wet color across its contact patch. Pickup approximates color exchange; it does not remove pigment from the surface or model individual moving bristles. Animated brush contacts use arc-length spacing so deposition is independent of frame rate; drying still depends on elapsed simulation time.
