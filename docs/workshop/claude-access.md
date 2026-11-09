# Claude access: notes for facilitators

Why Claude in the browser didn't connect to GitHub, what to do about it, and how to answer people who don't want Claude on their computer. Participants get the short version in the [setup guide](https://realtimeurbanismlab.github.io/weather-commons/guide/#access).

Checked against Anthropic's documentation on 5 November 2026. These products change often, so check again before relying on an exact menu name.

## Why the browser route failed

The most likely cause is a setting on the Team plan. It isn't a fault in the seats, GitHub or the repository.

On Team plans, **Sign in with GitHub** only works after an Owner of the Claude organization turns on the GitHub connector. Until then, members see "GitHub access is required for Claude Code cloud sessions" and no sign-in button. Personal plans don't have this step, so a rehearsal on a personal account would not have shown it.

This is not yet confirmed. It fits "no one could connect", but nobody has checked the setting. Other possible causes are in the checklist below.

The other common failures are people signed in to a personal Claude account instead of the workshop seat, and the Team-only **Create your first cloud environment** step, which the guide didn't mention before.

## What we recommend

| Who | Use | Why |
| --- | --- | --- |
| Everyone, by default | Route A: claude.ai/code in the browser | No install. Claude can reach the fork and not the laptop |
| People who want the app but not local access | Desktop app, Code tab, **Cloud** | Same as the browser |
| People who need previews, large data or Box | Route B: Desktop app, Code tab, **Local**, with the rules in the guide | Full tools, but Claude runs on their computer |
| Anyone uneasy about Local | Stay on Route A, or use a separate user account on the computer | A limit the computer itself enforces |

Installing through VS Code doesn't add protection. The extension is the same Claude Code, running on the same computer with the same access. Choose it only if someone prefers working in VS Code.

## Checklist for the Claude organization's Owner

Only an Owner of the workshop's Claude organization can do these.

1. **Turn on the GitHub connector:** [Organization settings → Connectors](https://claude.ai/admin-settings/connectors). This is required.
2. **Check that cloud sessions and Desktop are allowed:** [Organization settings → Claude Code](https://claude.ai/admin-settings/claude-code).
3. **Check seats:** every participant has their own Standard or Premium seat, under **Organization settings → Members**. Both include Claude Code. Each seat is for one person, and logins can't be shared.
4. **If the organization uses custom roles,** give members the cloud sessions permission under **Organization settings → Roles**.
5. **Check for blockers.** IP allowlisting makes cloud sessions fail with an authentication error. Zero Data Retention, a HIPAA configuration and customer-managed keys also block them.
6. **Leave Bypass permissions off.** On Team plans, it's controlled by organization policy.
7. **Optional: Quick setup,** under **Organization settings → Claude Code**. It skips the GitHub app and the environment form, and lets people link GitHub with `/web-setup`. Leave it off: with the app, a participant can limit Claude to their fork. `/web-setup` sends their full GitHub sign-in to Anthropic, and it needs a terminal.

## Test it before telling everyone

Use one participant's seat, not a personal account. Follow Route A from step 4 with their fork.

- [ ] **Sign in with GitHub** appears.
- [ ] The fork appears in the repository list.
- [ ] Claude makes the sketch and pushes a branch to the fork.
- [ ] A pull request opens in the fork, by Claude or with **Create PR**.
- [ ] After merging, the "pages" job gets a green tick and the page is live.

The documentation doesn't cover forks, so these last three steps are the ones to watch.

## What the browser route can't do

- **`gh pr` commands fail** in cloud sessions, with "GitHub GraphQL is not available from Claude Code sessions". Claude can use `gh api` instead, or the person can click **Create PR**.
- **Pull requests to the shared repository** will probably fail from a session attached to a fork, because a session can only use the repositories attached to it. Participants do this step by hand on GitHub. The guide already says how.
- **Downloads are limited.** The default network setting only reaches trusted sites such as GitHub and package registries. Participants can upload files themselves, or the environment can be set to a custom list.
- **No Box access.** Box is for lab members on Route B.

## The safety file

`.claude/settings.json` applies to everyone who has this repository in Claude Code, including lab members. It:

- blocks Claude's file tools from reading outside the working folder;
- turns off Bypass permissions;
- blocks reads of `.env` files, `~/.ssh` and `~/.aws`.

Tested on 5 November in the desktop app on Windows, in a Local session: a read outside the repository was refused, a read inside it worked, and a PowerShell command still read the outside file. So the file limits Claude's file tools and doesn't stop commands. The real protection on Local is that **Accept edits** and **Manual** ask before running most commands. Not tested on a Mac or in VS Code.

Lab members who need Claude to read the Box folder directly can add it for one session with `/add-dir` or **Add folder**. `node scripts/assets.mjs` isn't affected. Forks only get the file after **Sync fork**.

## Claude's sandbox

The sandbox is a limit on commands enforced by the operating system. It runs on Mac, Linux and WSL2. **On normal Windows, commands run unsandboxed.** It isn't in the safety file because its network rules would make `git push` and `gh` ask for approval, which would confuse people new to this. The documentation we read doesn't say how it behaves in the desktop app.

To try it, someone comfortable with a terminal can add this to `.claude/settings.local.json`, which stays on their computer:

```json
{
  "sandbox": {
    "enabled": true,
    "filesystem": {
      "denyRead": ["~/"],
      "allowRead": ["."]
    }
  }
}
```

Not tested. Sandbox rules cover commands only, so they work alongside the safety file rather than replacing it.

## If the browser route still can't work

GitHub Codespaces is the backup: a temporary computer in the browser with a full editor, and a personal GitHub account includes free monthly hours. Claude Code can be added to it. It would need a `.devcontainer` folder in the repository, and people would have to sign in to Claude in a terminal. The documentation implies it works but doesn't describe it directly, so test it before offering it.

## Sources

- [Get started with Claude Code in the cloud](https://code.claude.com/docs/en/web-quickstart)
- [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)
- [Claude Code desktop app](https://code.claude.com/docs/en/desktop)
- [VS Code extension](https://code.claude.com/docs/en/vs-code)
- [Permissions](https://code.claude.com/docs/en/permissions) and [sandboxing](https://code.claude.com/docs/en/sandboxing)
- [Dev containers](https://code.claude.com/docs/en/devcontainer)
- [Data usage](https://code.claude.com/docs/en/data-usage)
- [Claude Code on Team and Enterprise plans](https://support.claude.com/en/articles/11845131-use-claude-code-with-your-team-or-enterprise-plan)
- [Seats on Team plans](https://support.claude.com/en/articles/12004354-purchase-and-manage-seats-on-team-plans)
- [Getting started with Cowork](https://support.claude.com/en/articles/13345190-getting-started-with-cowork)
- [GitHub Codespaces billing](https://docs.github.com/en/billing/concepts/product-billing/github-codespaces)
