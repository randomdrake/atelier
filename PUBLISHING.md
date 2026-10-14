# From easel to public gallery

The owner has requested automatic publication of completed Atelier paintings to GitHub and this Site. Apply that default to Atelier painting requests, unless the user says local only or not to publish. Commit and push only the painting-project changes; verify the GitHub remote and push result. Then deploy the matching Site version. Report either destination if it fails.

The studio remains at port 5173. The separate viewing site is built from `public-gallery/`; it contains finished work, read-only replay, and a project explainer. The deployed assets never include the editor UI. A downloadable MIT source archive includes the project code and recorded sessions.

1. Finish and visually review the study in the browser. Export its actual PNG and complete version-2 session JSON. Store them in `examples/previews/<id>.png` and `examples/<id>.json`. Add the practice entry and truthful creation provenance.
2. Prepare the publication:

   `npm run gallery:add -- --id <id> --session examples/<id>.json --image examples/previews/<id>.png --description "A short description of the painting" --process "How it was made, including inspections and live or retrospective notes"`

   This copies the artwork and session, snapshots the four replay-engine modules by content hash, and updates the catalog. Existing published engine snapshots are retained, so future physics changes do not change earlier published replays.
3. Run `npm test`, `npm run check`, and `npm run gallery:build`. Use `npm run gallery:preview` for port 5174. Check finished view, replay, notes, pause, return to finished view, and small-screen layout.
4. Use the Sites skill and native tools. Read `.openai/hosting.json` and reuse its exact `project_id`; never create another Site for this gallery. Obtain a fresh source write credential, run the Sites source helper from the repository with the credential on hidden stdin, and package `dist-gallery` into an absolute archive path. Save the returned pushed commit/archive as a Site version, then deploy that exact version with the operation appropriate to its current audience. Confirm a successful deployment before calling it published.
5. `atelier.randomdrake.com` is the intended custom hostname. Use Sites custom-domain tools to read its current verification state. DNS must contain the exact CNAME and validation records returned by Sites. A working generated Sites URL does not prove that the custom domain is active.

Do not put Sites credentials, DNS credentials, browser storage, local screenshots of unrelated apps, or Git metadata into public output. The build uses an explicit asset list. If a tool or domain step is blocked, keep the completed painting and source and report the exact remaining step.
