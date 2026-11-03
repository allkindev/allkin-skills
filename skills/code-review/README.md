# Code review

For a developer agent. Given code, a diff or a script, it reads the whole
change, hunts for what breaks (correctness, security, data loss, behaviour
changes) before anything about style, and reports findings ranked by severity,
each with the exact line and a concrete failure case. Fixes come after the
findings and stay minimal.

It grants nothing: the agent keeps exactly the rights it has.
