# Análisis de datos

Para cualquier agente al que confíe tablas: un archivo CSV, TSV o Excel
(.xlsx). El agente nunca calcula una cifra «de cabeza»: unos scripts trazan el
perfil del archivo (tipos, celdas vacías o ilegibles, duplicados), filtran,
agrupan y calculan —sumas, medias, medianas, recuentos, cuotas, por categoría
o por mes— y dibujan gráficos sobrios en SVG. Después el agente escribe una
breve nota: primero la respuesta, los hallazgos con sus cifras y lo que los
datos no permiten afirmar.

Los scripts se ejecutan en el marco cerrado de Allkin para las competencias:
solo Node, sin red, leen la carpeta del agente y solo escriben en ella. El
archivo que se analiza debe estar en la carpeta del agente (un adjunto lo
está).

No concede nada: el agente conserva exactamente los derechos que tiene.
