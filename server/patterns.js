/**
 * 🎼 Preset Patterns Module
 * Initial patterns for startup, warm-up, and fallback
 */

export const INITIAL_PATTERNS = [
  {
    name: '🎵 互动起点 - 基础鼓点',
    description: '线下互动专用：从最简单的kick开始，等待观众互动逐步叠加音轨',
    code: `setcpm(138/4)

let filter_cutoff = slider(4.848,0,8)

$kick: s("bd:1!4")
  .duck("2").duckattack(.2).duckdepth(.8)
._scope()`,
  },
  {
    name: 'Full Demo',
    description: 'Strudel Official Demo (Replication)',
    code: `setcpm(138/4)

let filter_cutoff = slider(4.848,0,8)

$kick: s("bd:1!4")
  .duck("2").duckattack(.2).duckdepth(.8)
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
._pianoroll()`,
  },
];
