# Creature PNG Assets

This directory contains layered PNG assets for creature rendering.

## Directory Structure

```
creatures/
├── heads/
│   ├── head-0.png
│   ├── head-1.png
│   ├── ...
│   └── head-9.png
├── bodies/
│   ├── body-0.png
│   ├── body-1.png
│   ├── ...
│   └── body-9.png
└── legs/
    ├── legs-0.png
    ├── legs-1.png
    ├── ...
    └── legs-9.png
```

## Asset Specifications

- **Format**: PNG with transparency (RGBA)
- **Size**: 400x400 pixels (recommended)
- **Naming**: `{bodypart}-{id}.png` where id is 0-9
- **Layers**: Assets are layered from bottom to top (legs → body → head)

## Gene ID Mapping

Gene IDs from the contract map to asset files using modulo 10:

- Gene ID 0, 10, 20, 30... → asset-0.png
- Gene ID 1, 11, 21, 31... → asset-1.png
- etc.

## Rarity Visual Effects

Rarity is applied as CSS filters/overlays on top of the base assets:

- **Common**: No filter (base colors)
- **Rare**: Purple hue overlay
- **Legendary**: Gold hue overlay + glow effect

## Creating Assets

Each asset should:

1. Be centered in the 400x400 canvas
2. Have transparent background
3. Account for layering (heads on top, legs on bottom)
4. Use consistent proportions and alignment
5. Leave space for other layers

### Recommended Alignment

- **Heads**: Top 150px of canvas
- **Bodies**: Middle 200px of canvas
- **Legs**: Bottom 250px of canvas

## Example File Names

```
heads/head-0.png   # Round head
heads/head-1.png   # Square head
heads/head-2.png   # Alien head
...

bodies/body-0.png # Standard body
bodies/body-1.png # Muscular body
...

legs/legs-0.png    # Standard legs
legs/legs-1.png    # Mechanical legs
...
```
