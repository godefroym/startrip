# Startrip

Prototype navigateur d'un espace 3D local autour du Soleil.

Le MVP actuel fait trois choses :

- il pose un bubble jouable de `100 annees-lumiere`
- il affiche quelques etoiles proches nommees en `3D`
- il complete le volume avec un fond stellaire et un ciel lointain simules

## Lancer le prototype

Dans ce dossier :

```bash
python -m http.server 8000
```

Puis ouvre [http://localhost:8000](http://localhost:8000).

## Contenu actuel

- interface statique sans build
- scene `Three.js` chargee via CDN
- petit vaisseau pilotable
- sphere + cube de frontiere pour la zone de simulation
- catalogue local d'etoiles proches
- labels pour les principales etoiles
- couche externe qui simule les futures cartes profondes

## Hypothese assumee dans ce MVP

Le catalogue d'etoiles nommees est un echantillon de demarrage et les etoiles de fond sont synthetiques. L'objectif est d'avoir tout de suite une base jouable et une structure de code prete a recevoir de vraies donnees.

## Suite logique

- remplacer le fond synthetique par un export `Gaia` reel dans un rayon de `100 a.l.`
- estimer couleurs, rayons et classes depuis les champs photometriques
- projeter des tuiles `JWST` ou `ESO` sur une enveloppe du ciel lointain
- streamer des volumes voisins quand le joueur atteint la limite

La strategie de donnees proposee est detaillee dans [docs/data-pipeline.md](/C:/Users/godef/OneDrive/Documents/startrip/docs/data-pipeline.md).
