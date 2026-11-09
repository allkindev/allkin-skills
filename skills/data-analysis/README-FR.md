# Analyse de données

Pour tout agent à qui vous confiez des tableaux : un fichier CSV, TSV ou Excel
(.xlsx). L'agent ne calcule jamais un chiffre « de tête » : des scripts
dressent le profil du fichier (types, cellules manquantes ou illisibles,
doublons), filtrent, regroupent et calculent — sommes, moyennes, médianes,
décomptes, parts, par catégorie ou par mois — et dessinent des graphiques
sobres en SVG. L'agent écrit ensuite une courte note : la réponse d'abord, les
constats avec leurs chiffres, et ce que les données ne permettent pas de dire.

Les scripts tournent dans le cadre fermé d'Allkin pour les compétences : Node
seul, aucun réseau, ils lisent le dossier de l'agent et n'écrivent que là. Le
fichier à analyser doit se trouver dans le dossier de l'agent (une pièce
jointe y est).

Elle n'accorde rien : l'agent garde exactement les droits qu'il a.
