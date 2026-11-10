# Administración de Home Assistant

Para cualquier agente que se ocupe de una instalación de Home Assistant, a la
que accede por el servicio **Home Assistant** de Allkin. Da al agente un
método y los comandos exactos para cuatro trabajos:

- **Dispositivos nuevos** — escucha a petición las redes Zigbee (ZHA o
  Zigbee2MQTT), Z-Wave y RFXCOM, ve lo que llega, le dice qué es cada
  dispositivo y le pregunta qué quiere hacer con él: su nombre, su habitación,
  lo que conviene ocultar.
- **Nombres y habitaciones** — propone un esquema de nombres con ejemplos de
  su propia casa (`light.lustre_salon`, `binary_sensor.do_entree`…), renombra
  en lote y repara las automatizaciones y los paneles que citaban los
  identificadores antiguos.
- **Automatizaciones, scripts, escenas** — reformula su deseo como «cuando,
  solo si, entonces», comprueba que cada entidad existe, valida, crea y prueba
  con su acuerdo.
- **Paneles** — pregunta quién lo mira y en qué pantalla, construye vistas por
  uso y nunca sobrescribe un panel sin guardar su versión anterior.

Cada trabajo sigue el mismo orden: leer, proponer, obtener su acuerdo, guardar
la vuelta atrás, modificar, comprobar, informar. Lo que el agente no ha podido
comprobar — el aspecto de un panel, la reacción de un aparato — lo dice.

## Lo que necesita

- El servicio **Home Assistant**, con un token de acceso de larga duración de
  un administrador, concedido al agente — con escritura; sin ella el agente
  solo puede leer y escuchar.
- Nada más: no concede nada. El agente conserva exactamente los derechos que
  tiene.

## Lo que verá

Leer la instalación no le pide nada. Cada cambio — un renombrado, una
habitación, un panel guardado, una red abierta al emparejamiento — muestra una
tarjeta de validación en la conversación, una sola para todo el lote, que
puede aprobar para la sesión.

## Límites

- Los archivos escritos a mano en YAML (`configuration.yaml`, paquetes,
  paneles en modo YAML) quedan fuera de su alcance: el agente le dice qué
  cambiar en ellos.
- Una integración que pide una cuenta o una contraseña la añade usted, en
  Home Assistant.
- Detener Home Assistant o apagar su máquina se niega a todo agente. Un
  reinicio sigue siendo posible, con su tarjeta.
