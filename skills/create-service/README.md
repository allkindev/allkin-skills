# Create services

For any agent you want to have build services for Allkin. A service is what connects Allkin to
an external API: a definition — data, never code — that says where the API is, how the key
travels, how to test the connection, which calls wait for your approval, and what an agent needs
to know to use it. With this competence, the agent gathers these facts with you, writes the
definition and its help in the four languages in its **workshop** (the `workshop/` folder of its
own folder), checks it against Allkin's standard and corrects it until nothing is left to fix.

It is the key of the workshop tools: an agent that has it gets them — the list of its projects
and their check —, an agent that does not has none of them. What the agent writes shows up on the
**Services** page.

It widens no right: no command, no network, no access to any service comes with it — not even to
the one it writes. **You alone connect** a service, on that page, with a key the agent never
sees and must never be given, and you alone grant it to agents. Request signing and mail
transport are out of reach of such a definition. Only you give this competence to an agent.
