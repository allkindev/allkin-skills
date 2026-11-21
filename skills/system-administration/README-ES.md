# Administración de sistemas

El método y los comandos para administrar una máquina, sea cual sea su sistema: todas las
distribuciones Linux (Debian, Ubuntu, Fedora, RHEL, Arch, openSUSE, Alpine, Void, Gentoo, Solus)
y todos los sistemas de arranque (systemd, OpenRC, runit, s6), los contenedores y WSL — y macOS,
FreeBSD y Windows para las máquinas alcanzadas por SSH o mediante Allkin Client.

Con ella, el agente:

- **reconoce primero el sistema**, y usa su propio gestor de paquetes, su init y su cortafuegos;
- **instala, actualiza y desinstala software** desde fuentes de confianza, dice de dónde viene y
  si hace falta reiniciar;
- **gestiona servicios, usuarios, discos, la red, el cortafuegos y SSH**, guardando una copia de
  lo que cambia y preparando la vuelta atrás antes de todo lo que pudiera cortar el acceso;
- **escribe scripts de automatización** fiables: repetibles sin daño, con un ensayo en seco, un
  registro y una notificación si fallan — lanzados por usted como atajo o por una acción de
  Allkin, nunca por una programación oculta.

Nunca apaga una máquina, nunca debilita la seguridad sin decirlo, nunca descarga y ejecuta un
script de una vez. No amplía ningún derecho: cada comando se le sigue mostrando en su tarjeta.
