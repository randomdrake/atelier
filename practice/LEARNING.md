# How Atelier gets better

This is external practice memory, not a claim that the model's weights retrain between chats. New sessions read the journal, try a focused goal, and leave evidence for the next session. Improvements can come from better use of the tools, corrected simulator behavior, and human feedback. A changed model or renderer makes comparisons less controlled.

For each completed study, append an entry to `studies.json` with:

- `id`, `title`, `date`, `session`, `finishedImage`, and `media`.
- `goal`: one concrete thing to practice; `inspiration`: source and link, when applicable.
- `observations`: actual visible results and corrections, with stroke boundaries.
- `evidence`: screenshot or exported-image paths; reference the engine Git revision and model if known, otherwise mark unknown.
- `nextExperiment`: something testable in a later session.
- `assessment`: distinguish agent observations from user judgments. Do not invent numerical scores. Set `humanRating` to null until the user provides it.

Assess shape readability, light/shadow separation, edge variety, material character, composition, and whether corrections solved the observed issue. These are review criteria, not objective grades. Compare images side by side and invite a user's judgment when useful. More strokes, notes, or tests do not by themselves mean better art.

Every few studies, repeat a small calibration subject with the same palette, lighting direction, medium, stroke budget, and renderer revision. Compare it with the previous calibration, record both images, and report what is better, unchanged, or worse. If the renderer or model changes, label the comparison as confounded and start a new baseline. Keep failed experiments; they are evidence, too.

The first journal entries are retrospective summaries of already recorded sessions. No quality scores or unrecorded intentions are inferred. Future entries should state the goal before painting and assess it afterward.
