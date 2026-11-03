# Community management

For an agent that runs your social networks — X, Facebook, Instagram, Threads, LinkedIn,
YouTube, TikTok, Mastodon, Bluesky, Pinterest. It keeps your **editorial line** and your
**calendar** in files of its folder, writes each post once and **adapts it to every network**
(length as the network counts it, hashtags where they belong, the link where it does not hurt,
a thread when the text is long), **checks** it before anything goes out (limits, forbidden
words, media formats, a duplicate of the last thirty days), **triages the comments and
mentions** of all your networks into one list — the urgent ones first, spam aside — and proposes
the answers, **collects the figures** and writes the monthly report with numbers that come from
scripts, never from the model's impression.

## What it needs

- **Nothing** to write, plan and check: you copy and publish by hand.
- **A service per network** (X, Meta, LinkedIn, YouTube, Mastodon, Bluesky…), connected on the
  Services page and granted to the agent, to publish, read and measure from Allkin. Every call
  that publishes, answers or deletes shows you a card first.
- The right "Can schedule actions" and the competence "Manage actions" to schedule a post as an
  Allkin action; the web right to watch what is said about you.
- Its scripts run through Allkin's `run_skill_script`, in a closed frame (your agent's folder
  only, no network): one card the first time, then "always allow this competence" if you wish.

## What it does not do

It grants nothing: without a service, no publishing; without the web right, no watch. It never
publishes, answers or deletes without your card, never asks you to switch approval off, never
stores a password or a token, and never sends an image or a video yet (the networks' services
cannot send files for now): the text goes, you attach the visual.
