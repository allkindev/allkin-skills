# Contrôle de santé des serveurs

Pour tout agent qui veille sur des serveurs Linux — joints en SSH par les
services d'Allkin, ou la machine où tourne Allkin. Elle donne à l'agent une
ronde en lecture seule : disque et inodes, mémoire et charge, services qui
doivent tourner, mises à jour en attente et de sécurité, certificats,
sauvegardes, ports en écoute et connexions, erreurs dans les journaux, horloge.
Chaque contrôle a ses commandes et ses seuils ; les relevés de chaque ronde
sont gardés, pour que l'agent voie une tendance (« plein dans dix jours à ce
rythme ») ; le rapport est trié par urgence et propose la commande exacte pour
chaque constat — que l'agent ne lance pas.

Rien n'est réparé pendant une ronde, et rien de ce qui n'a pas pu être vérifié
n'est déclaré en bon état.

Elle n'accorde rien : l'agent garde exactement les droits qu'il a.
