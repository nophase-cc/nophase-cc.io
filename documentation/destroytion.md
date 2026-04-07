---
layout: page
title: Destroytion Docs
permalink: /documentation/destroytion/
---

## Overview

Destroytion is a JUCE-native stereo distortion plugin with tempo-synced random
modulation and a multi-stage nonlinear DSP path.

## Current Goals
- Keep animated destruction behavior musically usable
- Preserve a strong mid-range before extreme breakup
- Improve real-time modulation clarity for performance

## DSP Flow
1. Host transport read (`bpm`, optional `ppq`)
2. Modulation engine update
3. Parameter resolve and per-strip modulation
4. Input trim
5. Per-channel distortion processing
6. Optional autogain compensation
7. Output trim and dry/wet mix

## Main Strips
- HEAT
- EDGE
- FRACTURE
- FLUX
- FOCUS
- BLEND

## Modulation System
- Main Time: guaranteed rhythmic triggers
- Density Time: subdivision trigger grid
- Density: probability of extra events
- Smooth: interpolation/slew between targets
- Per-strip amount and BI/UNI polarity

## Build Notes
```bash
cd /Users/chuckles/Documents/c0d3/NOPHASE/DESTROYTION_VST
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j4
```
