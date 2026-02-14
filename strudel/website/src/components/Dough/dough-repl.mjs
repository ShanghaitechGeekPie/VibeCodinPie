// import { Dough, doughsamples } from 'dough-synth';
import { Dough, doughsamples } from 'https://unpkg.com/dough-synth@0.1.9/dough.js';
import { Pattern, noteToMidi, evaluate, stack } from '@strudel/core';
// import doughUrl from 'dough-synth?url';
import { transpiler } from '@strudel/transpiler';
//const doughBaseUrl = doughUrl.split('/').slice(0, -1).join('/') + '/';
const doughBaseUrl = 'https://unpkg.com/dough-synth@0.1.9/';

Object.assign(globalThis, { doughsamples });

export class DoughRepl {
  pattern;
  latency = 0.1;
  cps = 0.5;
  origin;
  t0;
  lasttime;
  strudel;
  q = [];
  constructor() {
    this.ready = this.init();
  }
  async init() {
    // init dough immediately, so that it can attach the document click event to initAudio immediately
    this.dough = new Dough({
      base: doughBaseUrl,
      //base: "../", // local dev
      onTick: ({ t0, t1 }) => {
        if (!this.pattern) {
          return;
        }
        this.origin ??= t0;
        this.t0 = t0;
        this.lasttime = performance.now();
        const a = (t0 - this.origin) * this.cps;
        const b = (t1 - this.origin) * this.cps;

        const haps = this.pattern.queryArc(a, b).filter((hap) => hap.hasOnset());
        if (!haps.length) {
          return;
        }
        haps.forEach((hap) => {
          const time = hap.whole.begin.valueOf() / this.cps + this.origin + this.latency;
          const duration = hap.duration.valueOf() / this.cps;
          const event = {
            dough: 'play',
            ...hap.value,
            time,
            duration,
          };
          if (event.note && typeof event.note === 'string') {
            event.note = noteToMidi(event.note);
          }
          //console.log("event", JSON.stringify(Object.entries(event)));
          this.dough.evaluate(event);
          this.q.push({ event, hap });
        });
      },
    });
    // miniAllStrings();
    const setcps = (cps) => (this.cps = cps);
    const setcpm = (cpm) => setcps(cpm / 60);
    const replScope = { setcps, setcpm };
    Object.assign(globalThis, replScope);
  }
  async evaluate(code) {
    await this.ready;
    let patterns = [];
    Pattern.prototype.p = function (id) {
      if (!id.startsWith('_')) {
        patterns.push(this);
      }
    };

    let { meta } = await evaluate(code, transpiler, { addReturn: false, wrapAsync: true, emitWidgets: false });
    const { miniLocations } = meta;

    this.pattern = stack(...patterns);
    return { miniLocations, pattern: this.pattern };
  }
  stop() {
    this.pattern = undefined;
    this.origin = undefined;
  }
  prebake() {
    return Promise.all([
      // doughsamples('github:eddyflux/crate')
    ]);
  }
  // tbd: move this to dough-synth
  get time() {
    return this.t0 + (performance.now() - this.lasttime) / 1000 + this.latency;
  }
  processHaps() {
    const currentHaps = [];
    const time = this.time;
    this.q = this.q.filter(({ event, hap }) => {
      const end = event.time + event.duration;
      const isActive = time >= event.time && time <= end;
      if (isActive) {
        currentHaps.push(hap);
      }
      return end > time; // delete old events
      // we do NOT return !isActive, because a frame might miss an event, which would cause a leak
    });
    // console.log(this.q.length); // to check for leaks
    return currentHaps;
  }
}
