import {
  initEditor,
  codemirrorSettings,
  flash,
  compartments,
  extensions,
  parseBooleans,
  activateTheme,
  updateMiniLocations,
  highlightMiniLocations,
} from '@strudel/codemirror';
import { evalScope, hash2code, code2hash } from '@strudel/core';
import { Framer } from '@strudel/draw';
import { persistentAtom } from '@nanostores/persistent';
import { DoughRepl } from './dough-repl.mjs';

let initialCode = '$: note("c a f e")';

export const code = persistentAtom('vanilla-repl-code', initialCode, {
  encode: JSON.stringify,
  decode: JSON.parse,
});

if (typeof window !== 'undefined') {
  try {
    const codeParam = window.location.href.split('#')[1] || '';
    if (codeParam) {
      const codeFromHash = hash2code(codeParam);
      code.set(codeFromHash);
    }
  } catch (err) {
    console.error('could not init code from url');
  }
}

export class DoughMirror {
  constructor(options) {
    const { root, initialCode = code.get(), bgFill = true } = options;
    this.root = root;
    this.code = initialCode;
    this.repl = new DoughRepl();
    this.prebaked = this.prebake();

    // init codemirror
    this.editor = initEditor({
      root,
      initialCode: this.code,
      onChange: (v) => {
        if (v.docChanged) {
          this.code = v.state.doc.toString();
          code.set(this.code);
        }
      },
      onEvaluate: this.evaluate.bind(this),
      onStop: () => this.stop(),
      mondo: false,
    });
    const settings = codemirrorSettings.get();
    this.setFontSize(settings.fontSize);
    this.setFontFamily(settings.fontFamily);

    // init event highlighting
    this.framer = new Framer(
      (time) => {
        const frameHaps = this.repl.processHaps();
        highlightMiniLocations(this.editor, time, frameHaps);
      },
      (err) => console.log('Framer error', err),
    );
  }
  prebake() {
    const modulesLoading = evalScope(import('@strudel/core'), import('@strudel/tonal'), import('@strudel/mini'));
    return Promise.all([modulesLoading, this.repl.prebake()]);
  }
  async evaluate() {
    this.framer.start();
    this.flash();
    await this.prebaked;
    const { miniLocations } = await this.repl.evaluate(this.code);
    window.location.hash = '#' + code2hash(this.code);
    updateMiniLocations(this.editor, miniLocations);
  }
  stop() {
    this.repl.stop();
    this.framer.stop();
    highlightMiniLocations(this.editor, 0, []);
  }
  // added synonym (compared to StrudelMirror)
  settings(settings = {}) {
    this.updateSettings(settings);
  }

  // the rest is copy pasted from StrudelMirror:

  updateSettings(settings = {}) {
    settings.fontSize && this.setFontSize(settings.fontSize);
    settings.fontFamily && this.setFontFamily(settings.fontFamily);
    for (let key in extensions) {
      if (key in settings) {
        this.reconfigureExtension(key, settings[key]);
      }
    }
    const updated = { ...codemirrorSettings.get(), ...settings };
    // console.log(updated);
    codemirrorSettings.set(updated);
  }
  reconfigureExtension(key, value) {
    if (!extensions[key]) {
      console.warn(`extension ${key} is not known`);
      return;
    }
    value = parseBooleans(value);
    const newValue = extensions[key](value, this);
    this.editor.dispatch({
      effects: compartments[key].reconfigure(newValue),
    });
    if (key === 'theme') {
      activateTheme(value);
    }
  }
  flash(ms) {
    flash(this.editor, ms);
  }
  setFontSize(size) {
    this.root.style.fontSize = size + 'px';
  }
  setFontFamily(family) {
    this.root.style.fontFamily = family;
    const scroller = this.root.querySelector('.cm-scroller');
    if (scroller) {
      scroller.style.fontFamily = family;
    }
  }
  setCode(code, offset = 0) {
    const changes = {
      from: 0,
      to: this.editor.state.doc.length + offset,
      insert: code,
    };
    this.editor.dispatch({ changes });
  }
  getCursorLocation() {
    return this.editor.state.selection.main.head;
  }
  setCursorLocation(col) {
    return this.editor.dispatch({ selection: { anchor: col } });
  }
  appendCode(code) {
    const cursor = this.getCursorLocation();
    this.setCode(this.code + code);
    this.setCursorLocation(cursor);
  }
}
