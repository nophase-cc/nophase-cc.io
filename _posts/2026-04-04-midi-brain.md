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

## Snapshot
- Status: functional prototype with web UI and live routing
- Format: Raspberry Pi-hosted MIDI middleware application
- Stack: Python, FastAPI, and JSON-backed config
- Focus: controller-first live performance without DAW dependency

## What It Is
- Live MIDI router with transport and clock handling
- Macro engine for one-to-many parameter control
- FastAPI web UI for setup, monitoring, and editing
- Scene-based workflow planning for performance states

## Current Direction
- Expand transform runtime beyond direct macro expansion
- Deepen scene recall and performance-state management
- Improve controller feedback and hardware integration

## Documentation
This page is the project overview. The runtime architecture, routing model, and
implementation details live in the docs.

- [Midi Brain Docs](/documentation/midi-brain/)
