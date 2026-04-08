---
layout: page
title: Bleap Docs
permalink: /documentation/bleap/
---

## Overview

Bleap is a focused JUCE sound-design plugin built for fast creation of risers,
impacts, downlifters, whooshes, noise sweeps, and transitional textures.

![Bleap interface overview](/assets/img/projects/bleap-1.png)

![Bleap modulation-focused view](/assets/img/projects/bleap-2.png)

![Bleap riser patch example](/assets/img/projects/bleap-3.png)

## Snapshot

- Status: playable prototype
- Framework: JUCE / C++
- Formats currently building: VST3, AU, Standalone
- Current emphasis: speed-to-result rather than deep synth complexity

## Core Signal Chain
`Oscillator + Noise -> Mixer -> Filter -> Amp/Env -> FX -> Output`

## Implemented Systems

- One oscillator with `Sine`, `Saw`, `Square`, and `Triangle`
- Noise source with `White`, `Pink`, and `Brown`
- Source blend, FM ratio/depth, and wavefold controls
- Filter morph, cutoff, resonance, and drive
- Separate amp and filter ADSR sections
- Three modulation slots with live DSP routing
- Editable modulation curves with add/remove point workflow
- Random and wiggle actions with section locks
- Reorderable FX chain with distortion, flanger, ring mod, delay, reverb, and width
- Header metering, oscilloscope, and lightweight spectrum display

## Workflow Model

- Global `Sync` / `Free` timing mode for modulation and time-based FX
- Built for one-shot sound design gestures instead of deep modular routing
- Destination tabs keep each modulation slot focused and fast to edit
- Randomization is meant for exploration, with wiggle covering nearby variations

## Current Gaps

- `unisonVoices` and `unisonDetune` are surfaced in UI/state but not yet active in DSP
- The macro control is still a simple global tonal push, not a full assignment system
- Preset browsing and preset management are not finished yet
- Host-reported tail length does not fully reflect the internal FX-tail behavior

## Direction

Bleap is intentionally not trying to be a general-purpose synthesizer. The
design target is quick, repeatable generation of production SFX with enough
controlled chaos to stay interesting.
