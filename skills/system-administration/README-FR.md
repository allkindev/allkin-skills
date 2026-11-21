# Administration système

La méthode et les commandes pour administrer une machine, quel que soit son système : toutes les
distributions Linux (Debian, Ubuntu, Fedora, RHEL, Arch, openSUSE, Alpine, Void, Gentoo, Solus)
et tous les systèmes d'init (systemd, OpenRC, runit, s6), les conteneurs et WSL — ainsi que
macOS, FreeBSD et Windows pour les machines atteintes en SSH ou par Allkin Client.

Avec elle, l'agent :

- **reconnaît d'abord le système**, et utilise son propre gestionnaire de paquets, son init et
  son pare-feu ;
- **installe, met à jour et désinstalle des logiciels** depuis des sources de confiance, dit d'où
  ils viennent et si un redémarrage est nécessaire ;
- **gère les services, les utilisateurs, les disques, le réseau, le pare-feu et SSH**, en
  sauvegardant ce qu'il modifie et en préparant le retour arrière avant tout ce qui pourrait
  couper l'accès ;
- **écrit des scripts d'automatisation** dignes de confiance : rejouables sans dommage, avec un
  essai à blanc, un journal et une notification en cas d'échec — lancés par vous en raccourci ou
  par une action d'Allkin, jamais par une planification cachée.

Il n'éteint jamais une machine, n'affaiblit jamais la sécurité sans le dire, ne télécharge et
n'exécute jamais un script d'un seul coup. Elle n'élargit aucun droit : chaque commande vous est
toujours présentée sur sa carte.
