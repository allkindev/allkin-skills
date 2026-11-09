# Control de salud de servidores

Para cualquier agente que cuide servidores Linux, alcanzados por SSH mediante
los servicios de Allkin, o la máquina donde funciona Allkin. Da al agente una
ronda de solo lectura: disco e inodos, memoria y carga, servicios que deben
funcionar, actualizaciones pendientes y de seguridad, certificados, copias de
seguridad, puertos a la escucha e inicios de sesión, errores en los registros,
el reloj. Cada comprobación tiene sus comandos y sus umbrales; las lecturas de
cada ronda se guardan, para que el agente vea una tendencia («lleno en diez
días a este ritmo»); el informe se ordena por urgencia y propone el comando
exacto para cada hallazgo, que el agente no ejecuta.

Nada se repara durante una ronda, y nada que no se haya podido comprobar se da
por bueno.

No concede nada: el agente conserva exactamente los derechos que tiene.
