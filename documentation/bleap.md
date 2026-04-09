---
layout: page
title: Bleap Docs
permalink: /documentation/bleap/
---

## Overview

Bleap is a focused JUCE sound-design plugin built for fast creation of risers,
impacts, downlifters, whooshes, noise sweeps, and transitional textures.

## Technical Snapshot

- Status: playable prototype
- Framework: JUCE / C++
- Formats currently building: VST3, AU, Standalone
- Current emphasis: speed-to-result rather than deep synth complexity

## Architecture
Bleap is split into a few practical layers:

- `Source/PluginProcessor.*`: JUCE host integration, parameter layout, MIDI event handling, scope/meter collection, state
- `Source/BleapEngine.*`: synthesis, modulation routing, envelopes, filter, and FX processing
- `Source/PluginEditor.*`: custom UI, modulation curve editing, randomization, and display logic

That split keeps the processor focused on host and state responsibilities while
the engine handles the actual sound generation.

## Key Systems

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

At a high level, the signal path is:

`Oscillator + Noise -> Mixer -> Filter -> Amp/Env -> FX -> Output`

## Implementation Notes
Bleap processes MIDI events inside the audio block and renders each region
between events through the engine:

```cpp
for (const auto metadata : midiMessages)
{
    const auto eventSample = juce::jlimit(0, buffer.getNumSamples(), metadata.samplePosition);
    engine.render(buffer, blockPosition, eventSample - blockPosition, params, transport);
    processMidiEvent(metadata.getMessage(), params, transport);
    blockPosition = eventSample;
}

engine.render(buffer, blockPosition, buffer.getNumSamples() - blockPosition, params, transport);
```

That is a good fit for one-shot SFX behavior because it keeps note triggers and
render state aligned without burying note logic inside the UI.

The runtime parameter struct is broad because Bleap exposes most of the sound
design path directly:

```cpp
struct RuntimeParameters
{
    Waveform waveform = Waveform::saw;
    float sourceMix = 0.0f;
    float fmRatio = 1.0f;
    float fmDepth = 0.0f;
    float foldAmount = 0.0f;
    NoiseType noiseType = NoiseType::white;
    float filterCutoffHz = 4000.0f;
    std::array<ModSlotParameters, 3> modSlots {};
    std::array<int, 6> fxOrder { 0, 1, 2, 3, 4, 5 };
};
```

This is one of Bleap's strengths: the plugin is not hiding its core motion and
tone-shaping systems behind a tiny macro surface. The important sound-design
decisions are first-class.

Bleap uses three modulation slots, each with a shape, timing mode, editable
curve data, and up to three routes. The engine advances each slot every sample
and applies the routed output to named targets.

```cpp
for (size_t slotIndex = 0; slotIndex < modulationStates.size(); ++slotIndex)
{
    const auto modulationValue = modulationStates[slotIndex].advance(random);
    for (const auto& route : params.modSlots[slotIndex].routes)
    {
        const auto routed = modulationValue * route.amount;
        switch (route.target)
        {
            case ModTarget::pitch:
                pitchModSemitones += routed * 24.0f;
                break;
            case ModTarget::filterCutoff:
                filterModulation += routed * 3.5f;
                break;
```

This avoids a huge generic matrix while still covering the destinations that
matter for SFX work.

The curve system is also richer than a simple LFO shape dropdown. Each slot can
store a custom point curve with per-segment bending:

```cpp
struct LfoCurveData
{
    bool useCustom = false;
    int pointCount = 2;
    std::array<LfoCurvePoint, maxLfoCurvePoints> points {};
    std::array<float, maxLfoCurvePoints - 1> segmentCurves {};
};
```

That is a strong design choice for transition FX, where envelope shape often
matters more than oscillator complexity.

At the source layer, Bleap combines a pitched oscillator, FM, wavefolding, and
a dedicated noise engine:

```cpp
auto oscillatorSample = renderOscillatorSample(params.waveform, oscillatorFrequency);
const auto noiseSample = renderNoiseSample(params.noiseType, effectiveNoiseTilt);
```

The oscillator section supports classic shapes, while the noise path can switch
between white, pink, and brown behavior. That mix is exactly what makes the
instrument useful for risers, impacts, and textured sweeps instead of only
pitched synth lines.

The engine owns the FX chain directly and applies it after source and envelope
processing:

```cpp
processFxChain(leftOutput, rightOutput, fxParams);
```

The current FX design includes distortion, flanger, ring modulation, delay,
reverb, and width, with reorder support in the parameter model. There is also a
tail-bypass path so the engine can continue generating FX-only output after the
main note has ended when needed.

## Current Focus
- `unisonVoices` and `unisonDetune` are surfaced in UI/state but not yet active in DSP
- The macro control is still a simple global tonal push, not a full assignment system
- Preset browsing and preset management are not finished yet
- Host-reported tail length does not fully reflect the internal FX-tail behavior
