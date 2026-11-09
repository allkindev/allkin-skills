# Server health check

For any agent that looks after Linux servers — reached over SSH through
Allkin's services, or the machine Allkin runs on. It gives the agent a
read-only round: disk and inodes, memory and load, services that must run,
pending and security updates, certificates, backups, listening ports and
sign-ins, errors in the logs, the clock. Each check has its commands and its
thresholds; the figures of each round are kept, so the agent sees a trend
("full in ten days at this rate"); the report is sorted by urgency and proposes
the exact command for each finding — which the agent does not run.

Nothing is repaired on a round, and nothing is reported as fine that could not
be checked.

It grants nothing: the agent keeps exactly the rights it has.
