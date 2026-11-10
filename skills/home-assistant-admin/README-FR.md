# Administration de Home Assistant

Pour tout agent qui s'occupe d'une installation Home Assistant, jointe par le
service **Home Assistant** d'Allkin. Elle donne à l'agent une méthode et les
commandes exactes pour quatre travaux :

- **Nouveaux périphériques** — il écoute à la demande les réseaux Zigbee (ZHA
  ou Zigbee2MQTT), Z-Wave et RFXCOM, voit ce qui arrive, vous dit ce qu'est
  chaque périphérique et vous demande ce que vous voulez en faire : son nom,
  sa pièce, ce qu'il faut masquer.
- **Noms et pièces** — il propose un schéma de nommage avec des exemples pris
  dans votre propre maison (`light.lustre_salon`, `binary_sensor.do_entree`…),
  renomme en lot, et répare les automatismes et les tableaux de bord qui
  citaient les anciens identifiants.
- **Automatismes, scripts, scènes** — il reformule votre souhait en « quand,
  seulement si, alors », vérifie que chaque entité existe, valide, crée, puis
  teste avec votre accord.
- **Tableaux de bord** — il demande qui le regarde et sur quel écran,
  construit des vues par usage, et n'écrase jamais un tableau de bord sans en
  garder la version précédente.

Chaque travail suit le même ordre : lire, proposer, obtenir votre accord,
garder de quoi revenir en arrière, modifier, vérifier, rendre compte. Ce que
l'agent n'a pas pu vérifier — l'aspect d'un tableau de bord, la réaction d'un
appareil — il le dit.

## Ce qu'il lui faut

- Le service **Home Assistant**, avec un jeton d'accès longue durée d'un
  administrateur, accordé à l'agent — avec l'écriture, sans quoi l'agent ne
  peut que lire et écouter.
- Rien d'autre : elle n'accorde rien. L'agent garde exactement les droits
  qu'il a.

## Ce que vous verrez

Lire l'installation ne vous demande rien. Chaque modification — un renommage,
une pièce, un tableau de bord enregistré, un réseau ouvert à l'appairage —
affiche une carte de validation dans la conversation, une seule pour tout le
lot, que vous pouvez approuver pour la session.

## Limites

- Les fichiers écrits à la main en YAML (`configuration.yaml`, packages,
  tableaux de bord en mode YAML) sont hors de portée : l'agent vous dit quoi
  y changer.
- Une intégration qui demande un compte ou un mot de passe, c'est vous qui
  l'ajoutez, dans Home Assistant.
- Arrêter Home Assistant ou éteindre sa machine est refusé à tout agent. Un
  redémarrage reste possible, sur sa carte.
