---
layout: page
title: CCGROOVE Docs
permalink: /documentation/ccgroove/
---

## Overview

CCGROOVE is a mobile-native groove box concept with a tracker-style model and
controller-first workflow for iOS and macOS.

## Milestone 1 Scope
- Four synthesized drum voices
- 16-step, 4-track sequencer
- Per-step velocity and ratchet
- BPM transport and live pattern interaction

## Architecture Direction
- Shared SwiftUI UI layer across Apple targets
- C++ engine long-term
- AudioKit for rapid prototype iteration
- CoreMIDI for USB/BLE controller input

## Build Order
1. Project skeleton
2. Drum voice engine
3. Sequencer model and clock
4. Pattern grid UI
5. Voice parameter panel
6. Keyboard/controller navigation
