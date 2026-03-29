# Pipeline de donnees vise

## Idee generale

On se limite a un bubble de `100 annees-lumiere` autour du Soleil pour la navigation proche.

- `Gaia` sert de source principale pour les etoiles en 3D
- `JWST` et `ESO` servent de couches visuelles pour le ciel lointain
- le navigateur ne doit pas charger des `FITS` bruts directement
- un pretraitement transforme les sources officielles en chunks compacts

## Pourquoi combiner ces jeux de donnees

`Gaia` est excellent pour la geometrie :

- ascension droite `ra`
- declinaison `dec`
- parallaxe `parallax`
- photometrie `phot_g_mean_mag`
- couleurs comme `bp_rp`

`JWST` et `ESO` sont excellents pour la richesse visuelle :

- images profondes
- mosaiques
- cubes spectraux
- catalogues de sources derives de certaines observations

## Conversion en 3D

Une fois la distance estimee, on projette chaque source dans le repere local :

```text
x = d * cos(dec) * cos(ra)
y = d * sin(dec)
z = d * cos(dec) * sin(ra)
```

Ou :

- `ra` et `dec` sont en radians
- `d` est la distance en annees-lumiere

## Pipeline recommande

1. Interroger `Gaia` pour un sous-ensemble local autour du Soleil.
2. Convertir les colonnes astro en positions cartesiennes.
3. Estimer couleur apparente, taille de rendu et niveau de detail.
4. Ecrire des chunks `JSON` ou binaires pour le front.
5. Construire une sphere lointaine avec des textures ou tuiles `JWST`/`ESO`.
6. Utiliser le navigateur uniquement pour le rendu et l'interaction.

## Script inclus dans ce repo

Le repo contient maintenant [scripts/fetch_gaia.py](/C:/Users/godef/OneDrive/Documents/startrip/scripts/fetch_gaia.py).

Exemple :

```bash
python scripts/fetch_gaia.py --radius-ly 100 --limit 20000
```

Sorties :

- `data/generated/gaia-nearby-stars.json`
- `data/generated/gaia-nearby-stars.csv`

Le front tente de charger automatiquement le JSON genere.

## Esquisse de requete Gaia

La requete exacte sera a ajuster selon la release cible, mais l'idee est :

```sql
SELECT
  source_id,
  ra,
  dec,
  parallax,
  phot_g_mean_mag,
  bp_rp
FROM gaiadr3.gaia_source
WHERE parallax >= 32.6
```

`32.6 mas` correspond environ a `100 annees-lumiere`.

## Integration JWST / ESO

Deux options propres pour la couche visuelle lointaine :

### Option 1

Projeter des images profondes sur une sphere du ciel.

- simple a afficher
- parfait pour l'ambiance
- pas de vraie profondeur

### Option 2

Deriver des nuages, galaxies et champs de particules depuis des catalogues de sources.

- plus couteux
- plus convaincant en volume
- permet une pseudo profondeur ou une profondeur partielle

## Limite importante

`JWST` et `ESO` ne donnent pas a eux seuls un univers complet en vraie 3D autour du joueur. Ils donnent surtout des observations du ciel. La vraie structure spatiale proche doit venir d'un catalogue astrometrique comme `Gaia`.

## Sources officielles utiles

- [Gaia DR3 Documentation](https://gea.esac.esa.int/archive/documentation/GDR3/)
- [JWST Science Data Overview](https://jwst-docs.stsci.edu/accessing-jwst-data/jwst-science-data-overview)
- [MAST API for JWST Metadata](https://outerspace.stsci.edu/display/MASTDOCS/API%2Bfor%2BJWST%2BMetadata)
- [ESO Archive](https://archive.eso.org/cms/eso-data.html)
