# Migrer des agents

Faites venir dans Allkin les agents que vous avez construits sur **OpenClaw** (ex-Clawdbot,
Moltbot) ou **NanoClaw**. L'agent qui a cette compétence — le modèle **Migrateur** est fait pour
cela — lit une archive de votre ancienne installation, laisse ses secrets de côté, et vous remet
une archive par agent à importer, avec une courte liste de ce qui reste à faire.

Le but est une bonne migration, pas une copie parfaite : ce qui trouve simplement sa place dans
Allkin est repris, le reste vous est listé.

## Ce qui est repris

| De | Dans Allkin |
|---|---|
| Identité, âme, règles de travail (`IDENTITY.md`, `SOUL.md`, `AGENTS.md`) — le `CLAUDE.md` d'un groupe sur NanoClaw | le **rôle** de l'agent, réécrit en un seul texte |
| Mémoire longue (`MEMORY.md`, `CLAUDE.local.md`) | la **mémoire** de l'agent (ses faits durables) |
| Notes du jour, fichiers d'un groupe | des **fichiers** de l'agent |
| Compétences (skills) | des **compétences**, dans un dépôt que vous ajoutez dans les Paramètres |

## Ce qui vous est listé

- **Tâches planifiées et heartbeat** → les **Actions** à créer (agent, heure, message).
- **Canaux** (Telegram, Discord…) → l'intégration ou le service à connecter. WhatsApp, Signal et
  iMessage n'ont pas encore d'équivalent.
- **Secrets** à saisir de nouveau, par leur nom — jamais leur valeur.
- **Scripts** qui ne peuvent pas tourner tels quels (Python, shell, appels réseau) : mis de côté,
  avec la raison.
- Ce que vous aviez dit de vous (`USER.md`), à ajouter à votre profil si vous le souhaitez.

Les conversations ne sont pas migrées.

## Comment l'utiliser

1. Faites un zip de votre ancienne installation, sur sa machine :
   - OpenClaw : `cd ~ && zip -r openclaw.zip .openclaw -x '.openclaw/agents/*/sessions/*' '*/node_modules/*'`
   - NanoClaw : `zip -r nanoclaw.zip nanoclaw -x '*/node_modules/*' 'nanoclaw/data/sessions/*'`
2. Joignez le zip dans une conversation avec l'agent et demandez-lui la migration.
3. Répondez à son formulaire : quels agents, quelles compétences, quels fichiers.
4. Suivez sa liste : importez chaque archive (le « + » de la liste des agents › Importer un
   agent), ajoutez le dépôt de compétences, accordez les droits que vous voulez, connectez les
   services, créez les actions.

## Sécurité

Le zip contient vos secrets : les scripts de la compétence n'extraient jamais les identifiants,
les transcriptions ni les valeurs du `.env`, et remplacent chaque jeton ou clé de la
configuration ; une archive est refusée tant qu'il reste quelque chose qui ressemble à un secret.
Le code de l'ancienne plateforme est lu, jamais exécuté. Un agent importé arrive sans aucun droit,
comme tout import, et les compétences converties attendent votre validation comme tout ce qui
vient de vos propres dépôts. Supprimez le zip du dossier `Upload/` de l'agent une fois la
migration terminée.

Ce qu'il faut à l'agent : rien de plus que cette compétence. Les scripts tournent dans le cadre
fermé d'Allkin (Node seul, sans réseau, dans le dossier de votre agent seulement).
