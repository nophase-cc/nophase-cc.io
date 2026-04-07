---
layout: page
title: Midi Brain Docs
permalink: /documentation/midi-brain/
---

## Overview

Midi Brain is a performance-first MIDI middleware app for Raspberry Pi.
It routes and transforms controller data for live setups without DAW dependency.

## Implemented Components
- MIDI router with transport and BPM tracking
- Macro engine with source/target mapping
- FastAPI web app for monitoring and editing
- JSON configuration and controller-map workflow

## Planned Components
- Transform runtime (LFO/random/steps)
- Scene save/load expansion
- Controller LED feedback sync

## Hardware Topology
- LaunchControl XL Mk3 -> Pi (USB)
- Midi Fighter Twister -> Pi (USB)
- Pi -> Digitone 2 (USB)
- Digitone 2 MIDI thru -> Analog Four Mk2
