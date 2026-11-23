# Island Water: kit for sketch 33

Research kit for **sketch 33** of the Realtime Weather working group: a citizen map of
where Aegean islands get their water, now and before desalination, zooming into Sifnos.

## Hand it off to VS Code

You need your fork of `RealtimeUrbanismLab/weather-commons` on your computer
(setup guide, Route B: `gh repo fork RealtimeUrbanismLab/weather-commons --clone`).

1. Unzip this kit **into the root of your fork**, so you have
   `weather-commons/island-water-kit/`.
2. In VS Code: **File → Open Folder…** → choose `weather-commons`.
   (To keep the merominia and sailing-ban projects open too, use **File → New Window**
   first, or **File → Add Folder to Workspace**.)
3. Open the Claude Code panel (Spark icon) and paste:

   > Read island-water-kit/CLAUDE.md and follow its "First session" steps: read
   > AGENTS.md, create sketch 33 with the repository's script (ask me for the author
   > name), move the kit into the sketch folder, then summarise what's in docs/ and data/
   > and what is missing. Ask before any bulk downloads.

4. From then on, work in the sketch folder. Suggested next prompt:

   > Start docs/tasks.md Phase 1. Begin with T1.1 (rain) and T1.2 (desalination plants).
   > Show me what you find before changing the design.

## What is here

| Path | What it is |
| --- | --- |
| `CLAUDE.md` | Rules and setup for Claude Code |
| `docs/brief.md` | The research brief |
| `docs/tasks.md` | Phased tasks: dig, design, build, share |
| `docs/dataset_hunt.md` | Every layer: what we need, where to look, search terms, who to ask |
| `docs/design.md` | Four-part structure, principles, tools, precedents |
| `docs/sifnos.md` | The Sifnos zoom: Poulati commons and the emergency years |
| `docs/interview_guide.md` | Questions for Sifnos residents, officials, projects |
| `docs/permissions.md` | Licences and what may be published |
| `data/*.csv` | Compiled facts with sources (islands, traditional systems, Sifnos timeline, desalination, datasets registry) |
| `tools/` | Rain, OpenStreetMap water features, cistern simulation, data checks |
| `private/` | Git-ignored: interview notes, contacts |

## Public

Your fork and the shared site are public. Nothing reaches the shared site until you open
a pull request to `RealtimeUrbanismLab` and it is merged. Keep private notes in `private/`.
