# Rime (experimental icy display font)

Built by reshaping every capital and digit of Cinzel Bold (SIL Open Font License 1.1, see `OFL-Cinzel.txt`).
Each letter is cut into flat facets, cracked into shards, and given icicles rooted on its downward-facing edges.

- `rime-v1.woff2` is the first version, kept as a backup. `rime_v1.py` is the script that made it:
  `python3 rime_v1.py <Cinzel-Bold with overlaps removed>.ttf <out dir> M` (writes `rime-M.woff2`).

- `rime-voronoi.woff2` is the chosen version: faceted, cracked with a Voronoi fracture (random seed points split
  each letter into cells; most cell walls become cracks), then icicles. `rime.py` holds every style tried:
  `python3 rime.py <Cinzel-Bold with overlaps removed>.ttf <out dir> V` (writes `rime-V.woff2`).
  Merge the overlaps first with `fontTools.ttLib.removeOverlaps`.

Not used by the app yet.
