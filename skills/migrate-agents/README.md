# Migrate agents

Bring the agents you built on **OpenClaw** (formerly Clawdbot, Moltbot) or **NanoClaw** into
Allkin. The agent that has this competence — the **Migrator** model is made for it — reads an
archive of your old install, leaves its secrets behind, and hands you one archive per agent to
import, with a short list of what is left to do.

The aim is a good migration, not a perfect copy: what fits Allkin simply is carried over, the rest
is listed for you.

## What is carried over

| From | In Allkin |
|---|---|
| Identity, soul, operating rules (`IDENTITY.md`, `SOUL.md`, `AGENTS.md`) — a group's `CLAUDE.md` on NanoClaw | the agent's **role**, rewritten as one text |
| Long-term memory (`MEMORY.md`, `CLAUDE.local.md`) | the agent's **memory** (its durable facts) |
| Daily notes, a group's files | **files** of the agent |
| Competences (skills) | **competences**, in a repository you add in the Settings |

## What is listed for you

- **Scheduled tasks and heartbeat** → the **Actions** to create (agent, time, message).
- **Channels** (Telegram, Discord…) → the integration or service to connect. WhatsApp, Signal and
  iMessage have no equivalent yet.
- **Secrets** you will have to enter again, by name — never their values.
- **Scripts** that cannot run as they are (Python, shell, network calls): set aside with why.
- What you said about yourself (`USER.md`), to add to your profile if you wish.

Conversations are not migrated.

## How to use it

1. Make a zip of your old install on its machine:
   - OpenClaw: `cd ~ && zip -r openclaw.zip .openclaw -x '.openclaw/agents/*/sessions/*' '*/node_modules/*'`
   - NanoClaw: `zip -r nanoclaw.zip nanoclaw -x '*/node_modules/*' 'nanoclaw/data/sessions/*'`
2. Attach the zip in a conversation with the agent and ask it to migrate.
3. Answer its form: which agents, which competences, which files.
4. Follow its list: import each archive (the "+" of the agents list › Import an agent), add the
   repository of competences, grant the rights you want, connect the services, create the actions.

## Safety

The zip holds your secrets: the competence's scripts never extract credentials, transcripts or the
values of `.env`, and replace every token or key in the configuration; an archive is refused while
anything that looks like a secret remains. The old platform's code is read, never run. An imported
agent arrives without any right, like every import, and the converted competences wait for your
validation like everything from your own repositories. Delete the zip from the agent's `Upload/`
folder once you are done.

What the agent needs: nothing more than this competence. The scripts run in Allkin's closed frame
(Node only, no network, your agent's folder only).
