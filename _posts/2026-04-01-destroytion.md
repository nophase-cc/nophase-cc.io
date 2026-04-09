---
title: Destroytion
author: charles
description: NOPHASE JUCE VST3 distortion plugin with working multi-stage DSP, host-synced random modulation, and a custom performance UI.
date: 2026-04-01 08:00:00 -0700
categories: [Projects, AU/VST]
tags: [destroytion, vst3, juce, distortion, modulation, audio-plugin, nophase]
---

## Summary
Destroytion is a native JUCE stereo distortion plugin focused on animated
destruction, rhythmic motion, and aggressive but playable timbral control. The
prototype is already running as a real VST3 with custom DSP and a purpose-built
editor, not just a concept patch.

## Snapshot
- Status: prototype in active iteration
- Format: native JUCE stereo VST3 effect
- Stack: JUCE and C++
- Focus: animated destruction with rhythmic motion and a strong musical middle

## What It Is
- HEAT
- EDGE
- FRACTURE
- FLUX
- FOCUS
- BLEND

Those six strips define the main sound-shaping identity of the plugin. The
project is built around tempo-synced random modulation, custom per-channel DSP,
and a performance-oriented editor rather than a generic distortion layout.

## Current Direction
- Preserve a musical mid-range before extreme breakup
- Improve voicing at high settings
- Continue UI clarity and real-time playability improvements

## Gallery

![Destroytion prototype interface](/assets/img/projects/destroytion-max-prototype.png)

![Destroytion interface overview](/assets/img/projects/destroytion-1.png)

## Documentation
This page is the project overview. The technical breakdown, DSP flow, and code
snippets live in the docs.

- [Destroytion Docs](/documentation/destroytion/)
