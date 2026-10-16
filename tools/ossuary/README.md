# Ossuary (experimental skull-and-bone display fonts)

Four styles, each built by reshaping every capital and digit of an open-licensed font (SIL OFL; licenses alongside):

- `ossuary-A.woff2` Skull: one skull face (glaring sockets, nasal cavity, teeth) carved into each letter around its roomiest counter. From Cinzel Black.
- `ossuary-B.woff2` Bone: every stroke end becomes the double knob of a bone, blended into the shaft. From Bebas Neue.
- `ossuary-C.woff2` Jaw: rows of teeth, with fangs at each end, under every long bottom edge. From Cinzel Black.
- `ossuary-D.woff2` Catacomb: bones plus skull faces, each skull with a stitched suture across the top. From Bebas Neue.

`python3 ossuary.py <Cinzel-Black>.ttf <BebasNeue>.ttf <out dir> [ABCD]` with both sources' overlaps merged first
(`fontTools.ttLib.removeOverlaps`). Not used by the app yet.
