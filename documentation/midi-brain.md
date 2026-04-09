---
layout: page
title: Midi Brain Docs
permalink: /documentation/midi-brain/
---

## Overview

Midi Brain is a performance-first MIDI middleware app for Raspberry Pi.
It routes and transforms controller data for live setups without DAW dependency.

## Technical Snapshot
- Status: functional prototype
- Platform: Raspberry Pi-hosted hardware workflow
- Stack: Python, `mido`, FastAPI, JSON config
- Focus: live routing, macro expansion, and browser-based setup for hardware rigs

## Architecture
The repository is already organized into a few distinct runtime pieces:

- `midi_router.py`: live input polling, forwarding, transport handling, and loop prevention
- `macro_engine.py`: one-to-many CC expansion from source controller messages
- `device_registry.py`: named device, track, parameter, channel, and port lookup
- `webapp.py`: FastAPI app plus in-browser router controls, learning, and test tools
- `config/*.json`: device definitions, macros, capabilities, and controller layouts

That split makes sense for a performance tool because routing, mapping, and UI
state can evolve somewhat independently.

## Key Systems
- MIDI router with transport and BPM tracking
- Macro engine with source/target mapping
- FastAPI web app for monitoring and editing
- JSON configuration and controller-map workflow

## Implementation Notes
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

## Current Focus
- Transform runtime (`lfo`, `random`, `steps`) is not yet wired into live routing
- Scene recall/apply is not fully connected to the runtime
- Controller LED or value feedback sync still needs implementation
- NRPN output and deeper device-specific behavior remain future work
