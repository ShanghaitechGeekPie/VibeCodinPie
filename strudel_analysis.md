# Strudel Code Analysis: Function-Parameter-Timing

Target Code:
```javascript
setcpm(138/4)

$kick: s("bd:1!4")
  .duck("2:3:4").duckattack(.2).duckdepth(.8)
._scope()

$chh: s("hh:1!4")
  .velocity(".2 .3 .8 .7")
  .gain(1.2)
  .fast(4)
._punchcard()

$ohh: s("oh:2!4")
  .velocity("0 0 1 0")
  .fast(4)
  .decay(.3)
  .gain(1.2)
._punchcard()

$bass: note("~ g1 g2 g1")
  .s("square")
  .fast(4)
  .decay(.2)
  .delay(.3)
  .orbit(2)
._pianoroll()

let filter_cutoff = slider(4.848,0,8)

$lead: note("<g3 d4 <f4 c4 f4 c4 g4 ~>>")
  .s("supersaw").detune(.5).gain(1.2)
  .fast(16)
  .lpf(200).lpenv(filter_cutoff).lpq(12)
  .release(.04)
  .hpf(300)
  .delay(.5).room(.4).roomsize(3)
  .orbit(2)
._pianoroll()

$subpad: note("g1")
  .s("supersaw").detune(1)
  .rel(0)
  .gain(1.3)
  .lpf(2000)
  .orbit(2)
._scope()

$pad: note("g3, d4, g4")
  .s("supersaw").detune(1)
  .delay(.5)
  .room(.5).roomsize(10)
  .hpf(400)
  .lpf(4000)
  .orbit(2)
._scope()

$arp: note("d6(5, 8)")
  .s("supersaw")
  .fast(2)
  .gain(.6)
  .sustain(0)
  .decay(.1)
  .hpf(800)
  .delay(.5)
  .pan(sine.fast(2))
  .orbit(2)
._pianoroll()
```

## Function-Parameter-Timing Table

| Function | Parameter | Timing / Scope | Description |
| :--- | :--- | :--- | :--- |
| `setcpm` | `138/4` (34.5) | Global | Sets cycles per minute. 138 BPM / 4 beats per cycle. |
| **$kick** | | **Track Scope** | **Kick Drum Track** |
| `s` | `"bd:1!4"` | Pattern | Sample source. "bd:1" repeated 4 times per cycle. |
| `duck` | `"2:3:4"` | Pattern | Sidechain compression rhythm. |
| `duckattack` | `.2` | Static | Ducking attack time. |
| `duckdepth` | `.8` | Static | Ducking depth amount. |
| `_scope` | | Visualizer | Oscilloscope widget. |
| **$chh** | | **Track Scope** | **Closed Hi-Hat** |
| `s` | `"hh:1!4"` | Pattern | Hi-hat sample. |
| `velocity` | `".2 .3 .8 .7"` | Pattern | Dynamic velocity (volume) variation per step. |
| `gain` | `1.2` | Static | Output gain boost. |
| `fast` | `4` | Time Transform | 4x speed (16th notes). |
| `_punchcard` | | Visualizer | Punchcard widget. |
| **$ohh** | | **Track Scope** | **Open Hi-Hat** |
| `s` | `"oh:2!4"` | Pattern | Open hat sample. |
| `velocity` | `"0 0 1 0"` | Pattern | Only plays on the 3rd 16th note (offbeat). |
| `fast` | `4` | Time Transform | 4x speed. |
| `decay` | `.3` | Static | Envelope decay. |
| **$bass** | | **Track Scope** | **Bass Line** |
| `note` | `"~ g1 g2 g1"` | Pattern | Bass notes. |
| `s` | `"square"` | Static | Square wave synth. |
| `fast` | `4` | Time Transform | 4x speed. |
| `delay` | `.3` | Static | Delay send. |
| **$lead** | | **Track Scope** | **Lead Synth (Reactive)** |
| `slider` | `4.848,0,8` | UI Widget | **Interactive Parameter** (Filter Envelope Amount). |
| `note` | `"<g3 d4 ...>"` | Pattern | Complex melody with polymetric structure. |
| `s` | `"supersaw"` | Static | Supersaw synth. |
| `fast` | `16` | Time Transform | 16x speed (fast arpeggio/trill). |
| `lpf` | `200` | Static | Low-pass filter base cutoff. |
| `lpenv` | `filter_cutoff` | **Reactive** | **Controlled by Slider**. Modulates LPF cutoff. |
| `lpq` | `12` | Static | Filter resonance. |
| **$subpad** | | **Track Scope** | **Sub Pad** |
| `note` | `"g1"` | Pattern | Root note drone. |
| `s` | `"supersaw"` | Static | Supersaw synth. |
| `rel` | `0` | Static | Release time. |
| **$pad** | | **Track Scope** | **Chord Pad** |
| `note` | `"g3, d4, g4"` | Pattern | G Major chord (no 3rd? G-D-G). |
| `room` | `.5` | Static | Reverb send. |
| `roomsize` | `10` | Static | Large reverb space. |
| **$arp** | | **Track Scope** | **High Arp** |
| `note` | `"d6(5, 8)"` | Pattern | Euclidean rhythm (5 hits in 8 steps). |
| `pan` | `sine.fast(2)` | Continuous LFO | Auto-panning L/R at 2 cycles/cycle. |

## Differences Analysis (vs Official Demo)

1.  **Audio Engine**:
    *   **Official**: Uses WebAudio via `@strudel/webaudio` (latest).
    *   **Local**: Uses `@strudel/web` v1.3.0 bundle.
    *   **Status**: Parity achieved via `initStrudel` sample loading and alias registration.

2.  **Visuals**:
    *   **Official**: CM6 widgets.
    *   **Local**: CM5 line widgets (`_scope`, `_pianoroll`).
    *   **Status**: Functional parity. Local widgets are canvas-based implementations injected via `client/screen.html`.

3.  **Reactivity (Critical)**:
    *   **Official**: `slider()` returns a reactive stream (`Pattern`).
    *   **Local**: `slider()` logic polyfilled in `client/screen.html`.
    *   **Fix Applied**: `safeEvaluate` now uses transpiled code to ensure `sliderWithID` is called, enabling bi-directional sync and `strudel.ref` reactivity.

4.  **Sync**:
    *   **Official**: AudioContext clock.
    *   **Local**: AudioContext clock + WebSocket sync for Master/Viewer.
