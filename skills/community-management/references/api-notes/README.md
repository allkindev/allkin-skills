# API notes, per network

For the model, before the first call to a network's service with `call_external_service`: the
handful of calls the competence needs — publish, reply, read comments and mentions, read
metrics —, the shape of a body, the trap. The service's own `agentGuide` (in your prompt) is
the reference when the two differ: these notes may age.

Every call that writes shows the user a card; a 401 or 403 is a missing scope or review on the
service's side, not your mistake: say so. A long answer is written by Allkin to a file of your
folder: move it to `community/inbox/raw/<network>-<date>.json` or `community/stats/raw/…`.
**Media cannot be sent yet** (no file in `call_external_service`): post the text, say so.
