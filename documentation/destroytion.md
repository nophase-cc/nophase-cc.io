---
layout: page
title: Destroytion Docs
permalink: /documentation/destroytion/
---

## Overview

Destroytion is a JUCE-native stereo distortion plugin with tempo-synced random
modulation and a multi-stage nonlinear DSP path.

![Destroytion interface overview](/assets/img/projects/destroytion-1.png)

![Destroytion stepped modulation example](/assets/img/projects/destroytion-2.png)

![Destroytion restrained modulation example](/assets/img/projects/destroytion-3.png)

## Snapshot

- Status: active JUCE prototype
- Target format: stereo VST3 audio effect
- Current editor size: `1080 x 572`
- Design priority: animated destruction with a strong musical middle

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

## Strip Roles

- `HEAT`: drive and saturation body
- `EDGE`: fold and destruction intensity
- `FRACTURE`: crush, hold, jitter, and dither character
- `FLUX`: ringmod and chaos motion
- `FOCUS`: filter tone and tracking behavior
- `BLEND`: body versus texture recombination

## Modulation System
- Main Time: guaranteed rhythmic triggers
- Density Time: subdivision trigger grid
- Density: probability of extra events
- Smooth: interpolation/slew between targets
- Per-strip amount and BI/UNI polarity
- Random and wiggle utilities with `MAIN`, `MOD`, and `FLAVOR` scopes

## UI Layout

- Left utility block for `RANDOM`, `WIGGLE`, and scope toggles
- Center modulation block for time selectors, trigger lights, density, smooth, and hold
- Right mixer block for input, output, metering, mix, and autogain
- Lower band with six color-coded strips and local modulation displays

## Build Notes
```bash
cmake -S . -B build
cmake --build build --parallel 4
```

## Direction

Destroytion is centered on rhythmically animated destruction rather than static
saturation. The current implementation is already modularized enough for
continued voicing and UI polish without losing the fast-iteration workflow.
