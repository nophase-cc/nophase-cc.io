---
layout: project
author: charles
permalink: /projects/midi-brain/
title: Midi Brain
description: NOPHASE performance-first MIDI middleware for live setups.
date: 2026-04-04 08:00:00 -0700
categories: [Projects, Other]
tags: [midi-brain, midi, performance, raspberry-pi, fastapi, routing, nophase]
kind: Hardware
status: Functional prototype
format: Raspberry Pi MIDI middleware
stack: Python / FastAPI
thumb:
accent: "#b69bff"
---

## Summary
Midi Brain is a performance-first MIDI middleware app running on Raspberry Pi.
It sits between controllers and instruments, handling intelligent routing and
control so the performer can stay focused on playing. It routes and transforms
controller data for live setups without DAW dependency.

## Snapshot
- Status: functional prototype with web UI and live routing
- Format: Raspberry Pi-hosted MIDI middleware application
- Platform: Raspberry Pi-hosted hardware workflow
- Stack: Python, `mido`, FastAPI, and JSON-backed config
- Focus: controller-first live performance without DAW dependency; live routing, macro expansion, and browser-based setup for hardware rigs

## What It Is
- Live MIDI router with transport and clock handling
- Macro engine for one-to-many parameter control
- FastAPI web UI for setup, monitoring, and editing
- Scene-based workflow planning for performance states

## Current Direction
- Expand transform runtime beyond direct macro expansion
- Deepen scene recall and performance-state management
- Improve controller feedback and hardware integration

## Technical Docs
Implementation details, architecture, and code excerpts for Midi Brain.

### Architecture
The repository is already organized into a few distinct runtime pieces:

- `midi_router.py`: live input polling, forwarding, transport handling, and loop prevention
- `macro_engine.py`: one-to-many CC expansion from source controller messages
- `device_registry.py`: named device, track, parameter, channel, and port lookup
- `webapp.py`: FastAPI app plus in-browser router controls, learning, and test tools
- `config/*.json`: device definitions, macros, capabilities, and controller layouts

That split makes sense for a performance tool because routing, mapping, and UI
state can evolve somewhat independently.

### Key Systems
- MIDI router with transport and BPM tracking
- Macro engine with source/target mapping
- FastAPI web app for monitoring and editing
- JSON configuration and controller-map workflow

### Implementation Notes
The router loop polls one selected MIDI input, forwards allowed messages to the
configured outputs, and then runs macro expansion on matching control-change
events:

```python
msg = midi_in.poll()
if msg is None:
    time.sleep(0.001)
    continue

self._send_to_outputs(options, outs, msg)

generated = self.macro_engine.expand(options.source_device_name, msg)
for out_name, out_msg in generated:
    out = outs.get(out_name)
```

That gives the project a simple but useful live model: direct forwarding first,
then higher-level control expansion.

The macro engine itself is intentionally straightforward. A single source CC can
fan out to multiple targets with per-target scaling:

```python
if macro.source_device != source_device_name or macro.source_cc != msg.control:
    continue

for target in macro.targets:
    value = _scale_value(msg.value, target.scale_min, target.scale_max)
```

The web layer wraps that runtime in editing and testing tools instead of trying
to replace the live engine:

```python
router = MidiRouter(registry, macro_engine)
options = RouterOptions(
    input_port=payload.input_port,
    output_ports=payload.output_ports,
    source_device_name=payload.source_device,
)
```

### Current Focus
- Transform runtime (`lfo`, `random`, `steps`) is not yet wired into live routing
- Scene recall/apply is not fully connected to the runtime
- Controller LED or value feedback sync still needs implementation
- NRPN output and deeper device-specific behavior remain future work
