# Gestion de communauté

Pour un agent qui anime vos réseaux sociaux — X, Facebook, Instagram, Threads, LinkedIn,
YouTube, TikTok, Mastodon, Bluesky, Pinterest. Il tient votre **ligne éditoriale** et votre
**calendrier** dans des fichiers de son dossier, écrit chaque publication une fois et **la
décline pour chaque réseau** (la longueur telle que le réseau la compte, les hashtags à leur
place, le lien là où il ne nuit pas, un fil quand le texte est long), **la vérifie** avant tout
envoi (limites, mots interdits, formats des médias, doublon des trente derniers jours), **trie
les commentaires et les mentions** de tous vos réseaux en une seule liste — les urgences
d'abord, le spam à part — et propose les réponses, **relève les chiffres** et rédige le rapport
mensuel avec des nombres qui viennent de scripts, jamais de l'impression du modèle.

## Ce qu'il lui faut

- **Rien** pour écrire, planifier et vérifier : vous copiez et publiez à la main.
- **Un service par réseau** (X, Meta, LinkedIn, YouTube, Mastodon, Bluesky…), connecté sur la
  page Services et accordé à l'agent, pour publier, lire et mesurer depuis Allkin. Chaque appel
  qui publie, répond ou supprime vous montre d'abord une carte.
- Le droit « Peut planifier des actions » et la compétence « Gérer les actions » pour programmer
  une publication comme une action d'Allkin ; le droit web pour la veille.
- Ses scripts tournent par l'outil `run_skill_script` d'Allkin, dans un cadre fermé (le dossier
  de votre agent seulement, sans réseau) : une carte la première fois, puis « Toujours autoriser
  cette compétence » si vous le souhaitez.

## Ce qu'elle ne fait pas

Elle n'accorde rien : sans service, pas de publication ; sans le droit web, pas de veille. Elle
ne publie, ne répond ni ne supprime jamais sans votre carte, ne vous demande jamais de couper
l'approbation, ne garde ni mot de passe ni jeton, et n'envoie pas encore d'image ni de vidéo
(les services des réseaux ne savent pas encore envoyer de fichier) : le texte part, vous joignez
le visuel.
