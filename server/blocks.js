/**
 * 🧱 Track Building Blocks Library
 * Pre-tested, good-sounding musical fragments for AI to compose with.
 * Each block is a single $: track that can be mixed and matched.
 *
 * Categories: kick, hihat, snare, perc, bass, lead, pad, arp, fx
 * Tags: intensity (1-3), genre hints
 */

// ── Helper registrations (prepended to output when needed) ──
export const HELPERS = `// Filter helpers
register('rlpf', (x, pat) => pat.lpf(pure(x).mul(12).pow(4)))
register('rhpf', (x, pat) => pat.hpf(pure(x).mul(12).pow(4)))

// Trance gate
register('trancegate', (density, seed, length, x) =>
  x.struct(rand.mul(density).round().seg(16).rib(seed, length)).fill(0.8).clip(0.8)
)
`;

// ── Blocks ──────────────────────────────────────────

export const BLOCKS = {
  // ═══════════════════════════════════════════════════
  // DRUMS
  // ═══════════════════════════════════════════════════
  kick_basic: {
    category: 'kick',
    intensity: 1,
    tags: ['house', 'trance', 'techno'],
    code: `$kick: s("bd:1!4")._scope()`,
  },
  kick_sidechain: {
    category: 'kick',
    intensity: 2,
    tags: ['trance', 'edm'],
    code: `$kick: s("bd:1!4")
  .duck("2:3:4").duckattack(.2).duckdepth(.8)
._scope()`,
  },
  kick_syncopated: {
    category: 'kick',
    intensity: 2,
    tags: ['house', 'techno'],
    code: `$kick: s("bd:1(3,8)")._scope()`,
  },
  kick_heavy: {
    category: 'kick',
    intensity: 3,
    tags: ['techno', 'dnb'],
    code: `$kick: s("bd:2!4").gain(1.3).shape(0.3)._scope()`,
  },

  hihat_basic: {
    category: 'hihat',
    intensity: 1,
    tags: ['house', 'trance'],
    code: `$chh: s("hh:1!4")
  .velocity(".2 .3 .8 .7")
  .gain(1.2).fast(4)
._punchcard()`,
  },
  hihat_offbeat: {
    category: 'hihat',
    intensity: 1,
    tags: ['house', 'trance'],
    code: `$hh: s("~ hh ~ hh").fast(4).gain(0.8)._punchcard()`,
  },
  hihat_rolling: {
    category: 'hihat',
    intensity: 2,
    tags: ['trance', 'techno'],
    code: `$hh: s("hh*16").gain(sine.range(0.3, 0.9).fast(4))._punchcard()`,
  },
  hihat_shuffle: {
    category: 'hihat',
    intensity: 2,
    tags: ['house', 'techno'],
    code: `$hh: s("hh(5,8)").gain(0.7).fast(2).pan(rand)._punchcard()`,
  },

  openhat_basic: {
    category: 'hihat',
    intensity: 1,
    tags: ['house', 'trance'],
    code: `$ohh: s("oh:2!4")
  .velocity("0 0 1 0")
  .fast(4).decay(.3).gain(1.2)
._punchcard()`,
  },

  snare_backbeat: {
    category: 'snare',
    intensity: 1,
    tags: ['house', 'trance'],
    code: `$sn: s("~ sd ~ sd").gain(0.9)._scope()`,
  },
  snare_breakbeat: {
    category: 'snare',
    intensity: 2,
    tags: ['dnb', 'breakbeat'],
    code: `$sn: s("~ sd ~ [sd sd:2]").gain(0.9).fast(2)._scope()`,
  },

  clap_basic: {
    category: 'perc',
    intensity: 1,
    tags: ['house', 'trance'],
    code: `$clap: s("~ cp ~ cp").room(0.3).gain(0.8)._scope()`,
  },
  perc_shaker: {
    category: 'perc',
    intensity: 1,
    tags: ['house', 'trance'],
    code: `$shaker: s("shaker*8").gain(0.4).pan(sine.fast(2))._scope()`,
  },
  perc_rim: {
    category: 'perc',
    intensity: 1,
    tags: ['minimal', 'techno'],
    code: `$rim: s("rim:2(3,8)").gain(0.6).delay(0.2)._scope()`,
  },

  // ═══════════════════════════════════════════════════
  // BASS
  // ═══════════════════════════════════════════════════
  bass_sub: {
    category: 'bass',
    intensity: 1,
    tags: ['trance', 'house'],
    code: `$subpad: note("g1")
  .s("supersaw").detune(1)
  .rel(0).gain(1.3).lpf(2000)
  .orbit(2)
._scope()`,
  },
  bass_pumping: {
    category: 'bass',
    intensity: 2,
    tags: ['trance', 'edm'],
    code: `$bass: note("~ g1 g2 g1")
  .s("square").fast(4)
  .decay(.2).delay(.3)
  .orbit(2)
._pianoroll()`,
  },
  bass_acid: {
    category: 'bass',
    intensity: 2,
    tags: ['acid', 'techno'],
    needsHelpers: true,
    code: `$bass: n("<0 4 0 9 7>*16").scale("g:minor")
  .octave(3).s("sawtooth")
  .lpf(100).lpenv(filter_cutoff).lps(.2).lpd(.12)
._pianoroll()`,
  },
  bass_deep: {
    category: 'bass',
    intensity: 1,
    tags: ['house', 'ambient'],
    code: `$bass: note("<g1 f1 c2 d1>")
  .s("sine").gain(1.2)
  .lpf(400).decay(0.4)
  .orbit(2)
._scope()`,
  },
  bass_reese: {
    category: 'bass',
    intensity: 3,
    tags: ['dnb', 'techno'],
    code: `$bass: note("g1*4")
  .s("supersaw").detune(2)
  .lpf(sine.range(200,1200).slow(4)).lpq(8)
  .gain(1.1).orbit(2)
._scope()`,
  },

  // ═══════════════════════════════════════════════════
  // LEADS
  // ═══════════════════════════════════════════════════
  lead_trance: {
    category: 'lead',
    intensity: 2,
    tags: ['trance', 'edm'],
    code: `$lead: note("<g3 d4 <f4 c4 f4 c4 g4 ~>>")
  .s("supersaw").detune(.5).gain(1.2)
  .fast(16)
  .lpf(200).lpenv(filter_cutoff).lpq(12)
  .release(.04).hpf(300)
  .delay(.5).room(.4).roomsize(3)
  .orbit(2)
._pianoroll()`,
  },
  lead_pluck: {
    category: 'lead',
    intensity: 1,
    tags: ['trance', 'house'],
    code: `$lead: note("<c4 e4 g4 b4>")
  .s("supersaw").detune(0.3)
  .decay(0.15).sustain(0).gain(0.9)
  .delay(0.4).room(0.3)
  .orbit(2)
._pianoroll()`,
  },
  lead_saw: {
    category: 'lead',
    intensity: 2,
    tags: ['trance', 'edm'],
    needsHelpers: true,
    code: `$lead: n("<3@3 4 5@3 6>*2".add("-14,-21"))
  .s("supersaw").scale("g:minor")
  .seg(16).orbit(2)
  .rlpf(filter_cutoff).lpenv(2)
  .gain(1.4)
._pianoroll()`,
  },
  lead_melody: {
    category: 'lead',
    intensity: 2,
    tags: ['trance', 'edm'],
    code: `$lead: n("0 2 4 <7 5> 4 2 0 <-2 -3>")
  .scale("G:minor").s("supersaw").detune(0.4)
  .fast(4).gain(0.9)
  .lpf(filter_cutoff.mul(750)).lpq(4)
  .delay(0.3).room(0.3)
  .orbit(2)
._pianoroll()`,
  },

  // ═══════════════════════════════════════════════════
  // PADS
  // ═══════════════════════════════════════════════════
  pad_warm: {
    category: 'pad',
    intensity: 1,
    tags: ['trance', 'ambient'],
    code: `$pad: note("g3, d4, g4")
  .s("supersaw").detune(1)
  .delay(.5).room(.5).roomsize(10)
  .hpf(400).lpf(4000)
  .orbit(2)
._scope()`,
  },
  pad_evolving: {
    category: 'pad',
    intensity: 2,
    tags: ['ambient', 'trance'],
    code: `$pad: note("<g3,b3,d4 a3,c4,e4>")
  .s("supersaw").detune(1.5)
  .lpf(sine.range(800,3000).slow(8)).lpq(2)
  .room(0.6).roomsize(8)
  .gain(0.7).orbit(2)
._scope()`,
  },
  pad_strings: {
    category: 'pad',
    intensity: 1,
    tags: ['ambient', 'cinematic'],
    code: `$pad: note("<g3,b3,d4 f3,a3,c4 e3,g3,b3>")
  .s("sawtooth")
  .attack(0.3).release(0.5)
  .lpf(2000).room(0.7).roomsize(6)
  .gain(0.6).orbit(2)
._scope()`,
  },

  // ═══════════════════════════════════════════════════
  // ARPS
  // ═══════════════════════════════════════════════════
  arp_trance: {
    category: 'arp',
    intensity: 2,
    tags: ['trance', 'edm'],
    code: `$arp: n("0@2 <-7 [-5 -2]>@3 <0 -3 1 2>@3".add("7,-7").add("<5 4 0 <0 2>>"))
  .s("supersaw").scale("g:minor")
  .trancegate(1.5,45,2)
  .orbit(3).delay(0.4).pan(rand)
  .rlpf(filter_cutoff).lpenv(2)
._pianoroll()`,
    needsHelpers: true,
  },
  arp_simple: {
    category: 'arp',
    intensity: 1,
    tags: ['trance', 'house'],
    code: `$arp: n("0 2 4 7").scale("G:minor")
  .s("supersaw").fast(4)
  .gain(0.6).sustain(0).decay(0.1)
  .hpf(800).delay(0.5)
  .pan(sine.fast(2))
  .orbit(2)
._pianoroll()`,
  },
  arp_fast: {
    category: 'arp',
    intensity: 2,
    tags: ['trance', 'edm'],
    code: `$arp: note("d6(5,8)")
  .s("supersaw").fast(2)
  .gain(.6).sustain(0).decay(.1)
  .hpf(800).delay(.5)
  .pan(sine.fast(2))
  .orbit(2)
._pianoroll()`,
  },
  arp_pluck: {
    category: 'arp',
    intensity: 1,
    tags: ['house', 'ambient'],
    code: `$arp: n("<0 2 4 7 9 7 4 2>")
  .scale("G:minor").s("triangle")
  .fast(8).gain(0.5)
  .decay(0.08).sustain(0)
  .delay(0.4).delayfeedback(0.3)
  .pan(rand).orbit(2)
._pianoroll()`,
  },

  // ═══════════════════════════════════════════════════
  // FX / TEXTURE
  // ═══════════════════════════════════════════════════
  fx_riser: {
    category: 'fx',
    intensity: 2,
    tags: ['trance', 'edm'],
    code: `$fx: s("noise")
  .gain(0.3).lpf(sine.range(200,8000).slow(16))
  .room(0.8).pan(sine.fast(1))
._scope()`,
  },
  fx_pulse: {
    category: 'fx',
    intensity: 1,
    tags: ['techno', 'minimal'],
    code: `$fx: s("pulse!16").dec(.1)
  .fm(sine.range(1,4).slow(8))
  .fmh(sine.range(1,2).slow(4))
  .orbit(4)
._scope()`,
  },
  fx_atmosphere: {
    category: 'fx',
    intensity: 1,
    tags: ['ambient', 'trance'],
    code: `$fx: s("wind:2")
  .gain(0.2).room(0.9).roomsize(12)
  .lpf(1500).slow(4)
._scope()`,
  },
};

// ── Block metadata for prompt ──────────────────────

/**
 * Generate a compact block catalog string for the AI prompt.
 * Lists block IDs grouped by category with brief descriptions.
 */
export function getBlockCatalog() {
  const grouped = {};
  for (const [id, block] of Object.entries(BLOCKS)) {
    const cat = block.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      id,
      intensity: block.intensity,
      tags: block.tags,
    });
  }

  let catalog = '';
  for (const [cat, blocks] of Object.entries(grouped)) {
    catalog += `\n### ${cat.toUpperCase()}\n`;
    for (const b of blocks) {
      catalog += `- \`${b.id}\` (intensity:${b.intensity}) [${b.tags.join(', ')}]\n`;
    }
  }
  return catalog;
}

/**
 * Assemble a full Strudel code string from a list of block IDs + optional overrides.
 * @param {string} bpm - BPM string like "138"
 * @param {string} key - Key like "g:minor"
 * @param {string[]} blockIds - Array of block IDs to include
 * @returns {string} Complete Strudel code
 */
export function assembleFromBlocks(bpm, key, blockIds) {
  let needsHelpers = false;
  const tracks = [];

  for (const id of blockIds) {
    const block = BLOCKS[id];
    if (!block) continue;
    if (block.needsHelpers) needsHelpers = true;
    tracks.push(block.code);
  }

  let output = `setcpm(${bpm}/4)\n\n`;
  if (needsHelpers) {
    output += HELPERS + '\n';
  }
  output += tracks.join('\n\n') + '\n';
  return output;
}
