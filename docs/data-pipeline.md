# Pipeline de donnees vise

## Idee generale

On se limite a un bubble de `100 annees-lumiere` autour du Soleil pour la navigation proche.

- `Gaia` sert de source principale pour les etoiles en 3D
- `NASA Exoplanet Archive` sert de source principale pour les exoplanetes confirmees
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
- temperature `teff_gspphot`
- rayon `radius_flame`

`NASA Exoplanet Archive` est excellent pour les systemes planetaires :

- `gaia_dr3_id` et `hip_name` pour raccrocher les hotes au bubble Gaia
- `sy_dist`, `ra`, `dec` pour la position du systeme
- `pl_orbsmax`, `pl_orbper`, `pl_orbeccen` pour l'orbite
- `pl_rade`, `pl_bmasse`, `pl_eqt` pour un rendu et une fiche plus riches

Pour le gaz local dans le prototype actuel :

- `HI4PI` sert de base officielle legere pour la distribution angulaire du gaz neutre
- `eROSITA` inspire la composante de plasma chaud local
- la profondeur 3D du gaz reste en partie reconstruite pour le rendu

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

Le repo contient aussi [scripts/fetch_exoplanets.py](/C:/Users/godef/OneDrive/Documents/startrip/scripts/fetch_exoplanets.py).

Exemple :

```bash
python scripts/fetch_exoplanets.py --radius-ly 100 --limit 5000
```

Sorties :

- `data/generated/exoplanets-nearby.json`
- `data/generated/exoplanets-nearby.csv`

Le front tente aussi de charger automatiquement ce JSON.

Le JSON exporte inclut aussi des champs prets pour le rendu du jeu :

- `radiusSolar`
- `radiusSource`
- `temperatureK`
- `temperatureSource`
- `colorRgb`
- `colorHex`
- `colorSource`
- `apparentMagnitudeG`
- `absoluteMagnitudeG`
- `visualBrightness`
- `brightnessSource`

Attention : `visualBrightness` est une metrique de rendu compressee pour le jeu. Ce n'est pas une luminosite physique brute, mais une aide pour afficher une hierarchie visuelle lisible.

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

## Compromis actuels pour les nouvelles couches

### Exoplanetes

- les exoplanetes sont reelles et viennent de la `NASA Exoplanet Archive`
- les orbites sont tres fortement compressees pour rester visibles dans une scene exprimee en annees-lumiere
- la vitesse orbitale est acceleree pour qu'on voie quelque chose bouger a l'ecran
- on garde surtout la topologie des systemes, pas une echelle physique jouable

### Gaz

- la repartition angulaire du gaz neutre vient de `HI4PI`
- la composante chaude locale est une reconstruction visuelle inspiree par `eROSITA`
- la profondeur radiale de la couche `HI4PI` n'est pas mesuree dans ce prototype: elle est extrudee en epaisseur pour produire un volume navigable
- la couleur du gaz est pseudo-visible: elle est derivee du pic d'emission thermique du plasma, puis remappee dans le visible pour le rendu jeu

## Sources officielles utiles

- [Gaia DR3 Documentation](https://gea.esac.esa.int/archive/documentation/GDR3/)
- [NASA Exoplanet Archive PS/PSCompPars columns](https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html)
- [NASA Exoplanet Archive transition to PS/PSCompPars](https://exoplanetarchive.ipac.caltech.edu/docs/transition.html)
- [HI4PI detailed product description](https://lambda.gsfc.nasa.gov/product/foreground/fg_hi4pi_info.html)
- [eROSITA 3D view of the LHB and the solar neighbourhood](https://erosita.mpe.mpg.de/dr1/AllSkySurveyData_dr1/DiffuseBkg/k3d.html)
- [JWST Science Data Overview](https://jwst-docs.stsci.edu/accessing-jwst-data/jwst-science-data-overview)
- [MAST API for JWST Metadata](https://outerspace.stsci.edu/display/MASTDOCS/API%2Bfor%2BJWST%2BMetadata)
- [ESO Archive](https://archive.eso.org/cms/eso-data.html)
