---
title: Midi Brain
author: charles
description: NOPHASE performance-first MIDI middleware for live setups.
date: 2026-04-04 08:00:00 -0700
categories: [Projects, Other]
tags: [midi-brain, midi, performance, raspberry-pi, fastapi, routing, nophase]
---

## Summary
Midi Brain is a performance-first MIDI middleware app running on Raspberry Pi.
It sits between controllers and instruments, handling intelligent routing and
control so the performer can stay focused on playing.

## Status
Functional prototype with web UI and live routing.

## Format
- Raspberry Pi-hosted MIDI middleware application
- Hardware-first tool for controller routing, clock handling, and live setup logic
- Includes a FastAPI web interface for monitoring and editing
- Designed to run outside a DAW-centered workflow

## Current Direction
- Live MIDI router with transport and clock handling
- Macro engine for one-to-many parameter control
- FastAPI web UI for setup, monitoring, and editing
- Scene-based workflow planning for performance states

## Target Use
Controller-first live performance without DAW dependency.

## Documentation
- [Midi Brain Docs](/documentation/midi-brain/)
