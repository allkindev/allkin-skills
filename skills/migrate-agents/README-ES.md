# Migrar agentes

Traiga a Allkin los agentes que construyó en **OpenClaw** (antes Clawdbot, Moltbot) o
**NanoClaw**. El agente que tiene esta competencia — el modelo **Migrador** está hecho para ello —
lee un archivo de su antigua instalación, deja fuera sus secretos y le entrega un archivo por
agente para importar, con una breve lista de lo que queda por hacer.

El objetivo es una buena migración, no una copia perfecta: lo que encaja simplemente en Allkin se
traslada, el resto se le enumera.

## Lo que se traslada

| Desde | En Allkin |
|---|---|
| Identidad, alma, reglas de trabajo (`IDENTITY.md`, `SOUL.md`, `AGENTS.md`) — el `CLAUDE.md` de un grupo en NanoClaw | el **rol** del agente, reescrito en un solo texto |
| Memoria a largo plazo (`MEMORY.md`, `CLAUDE.local.md`) | la **memoria** del agente (sus hechos duraderos) |
| Notas diarias, archivos de un grupo | **archivos** del agente |
| Competencias (skills) | **competencias**, en un repositorio que usted añade en la Configuración |

## Lo que se le enumera

- **Tareas programadas y heartbeat** → las **Acciones** que crear (agente, hora, mensaje).
- **Canales** (Telegram, Discord…) → la integración o el servicio que conectar. WhatsApp, Signal e
  iMessage aún no tienen equivalente.
- **Secretos** que tendrá que introducir de nuevo, por su nombre — nunca su valor.
- **Scripts** que no pueden ejecutarse tal cual (Python, shell, llamadas de red): apartados, con
  el motivo.
- Lo que había dicho de usted (`USER.md`), para añadirlo a su perfil si lo desea.

Las conversaciones no se migran.

## Cómo usarla

1. Haga un zip de su antigua instalación, en su máquina:
   - OpenClaw: `cd ~ && zip -r openclaw.zip .openclaw -x '.openclaw/agents/*/sessions/*' '*/node_modules/*'`
   - NanoClaw: `zip -r nanoclaw.zip nanoclaw -x '*/node_modules/*' 'nanoclaw/data/sessions/*'`
2. Adjunte el zip en una conversación con el agente y pídale la migración.
3. Responda a su formulario: qué agentes, qué competencias, qué archivos.
4. Siga su lista: importe cada archivo (el «+» de la lista de agentes › Importar un agente),
   añada el repositorio de competencias, conceda los derechos que quiera, conecte los servicios,
   cree las acciones.

## Seguridad

El zip contiene sus secretos: los scripts de la competencia nunca extraen credenciales,
transcripciones ni los valores del `.env`, y sustituyen cada token o clave de la configuración; un
archivo se rechaza mientras quede algo que parezca un secreto. El código de la antigua plataforma
se lee, nunca se ejecuta. Un agente importado llega sin ningún derecho, como toda importación, y
las competencias convertidas esperan su validación como todo lo que viene de sus propios
repositorios. Elimine el zip de la carpeta `Upload/` del agente al terminar.

Lo que necesita el agente: nada más que esta competencia. Los scripts se ejecutan en el marco
cerrado de Allkin (solo Node, sin red, solo en la carpeta de su agente).
