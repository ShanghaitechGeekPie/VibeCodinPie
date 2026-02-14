/**
 * 🎼 Preset Patterns Module
 * Initial patterns for startup, warm-up, and fallback
 */

export const INITIAL_PATTERNS = [
  {
    name: '🌙 Ambient Opener',
    description: '柔和的环境音乐，适合开场',
    code: `// 🌙 Ambient Opener
setcps(0.4)

// ✨ 柔和的 Pad
$: note("<c3 e3 g3 b3>")
  .s("sine")
  .room(0.8)
  .gain(0.4)
  .lpf(1200)
  .delay(0.5)
  ._scope({smear:0.9})

// 🫧 随机音符点缀
$: n("0 2 4 7")
  .scale("C:minor")
  .s("pluck")
  .gain(0.3)
  .room(0.6)
  .sometimes(x => x.speed(2))
  ._pianoroll({labels:1})`,
  },
  {
    name: '🥁 Lo-fi Beat',
    description: 'Lo-fi hip hop 节拍',
    code: `// 🥁 Lo-fi Beat
setcps(0.45)

// 🥁 鼓组
$: s("bd ~ [~ bd] ~, ~ sd ~ sd, hh*8")
  .bank("RolandTR808")
  .gain("1 .8 .9 .7")
  ._pianoroll({labels:1})

// 🎹 和弦
$: note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("superpiano")
  .gain(0.35)
  .room(0.5)
  .lpf(2000)
  ._pianoroll()

// 🎸 贝斯
$: note("<c2 a1 f1 g1>")
  .s("sawtooth")
  .lpf(400)
  .gain(0.5)
  ._scope({smear:0.8})`,
  },
  {
    name: '⚡ Synth Wave',
    description: '充满能量的合成器波形',
    code: `// ⚡ Synth Wave
setcps(0.55)

// 🥁 四拍底鼓
$: s("bd*4")
  .bank("RolandTR909")
  .gain(0.9)
  ._pianoroll({labels:1})

// 🎩 踩镲律动
$: s("[~ hh]*4")
  .gain(".5 .8 .6 1")
  .pan(sine.range(0.3, 0.7))
  ._scope()

// 🎹 合成器主旋律
$: note("c4 e4 g4 c5 b4 g4 e4 c4")
  .s("supersaw")
  .lpf(sine.range(500, 3000).slow(8))
  .room(0.3)
  .gain(0.4)
  ._pianoroll({labels:1})

// 🔊 贝斯线
$: note("<c2 c2 f2 g2>")
  .s("square")
  .lpf(300)
  .gain(0.6)
  .distort(0.1)
  ._scope({smear:0.7})`,
  },
  {
    name: '🌍 World Percussion',
    description: '世界音乐打击乐风格',
    code: `// 🌍 World Percussion
setcps(0.5)

// 🥁 主鼓
$: s("bd [~ bd] sd [bd ~]")
  .gain("1 .7 .9 .6")
  ._pianoroll({labels:1})

// 🪘 打击乐层
$: s("~ rim [~ cp] ~, hh*6")
  .gain(0.6)
  .pan(rand)
  ._pianoroll()

// 🎵 东方旋律
$: n("0 3 5 7 10 7 5 3")
  .scale("C:phrygian")
  .s("pluck")
  .room(0.4)
  .gain(0.45)
  ._pianoroll({labels:1})

// 🔉 低音
$: note("<c2 ~ f2 ~>")
  .s("sine")
  .gain(0.5)
  ._scope({smear:0.8})`,
  },
  {
    name: '🏠 House Groove',
    description: '经典 House 节奏',
    code: `// 🏠 House Groove
setcps(0.52)

// 🥁 四拍
$: s("bd*4, ~ cp ~ cp")
  .bank("RolandTR909")
  .gain(0.85)
  ._pianoroll({labels:1})

// 🎩 开镲律动
$: s("[~ oh]*4")
  .bank("RolandTR909")
  .gain("0.4 0.6 0.5 0.8")
  ._scope()

// 🎹 和弦 Stab
$: note("<[c4,e4,g4] ~ [f4,a4,c5] ~>")
  .s("superpiano")
  .gain(0.3)
  .room(0.4)
  .lpf(3000)
  ._pianoroll()

// 🎸 Walking Bass
$: note("c2 [c2 c3] f2 [g2 g1]")
  .s("sawtooth")
  .lpf(500)
  .gain(0.55)
  ._scope({smear:0.6})`,
  },
  {
    name: '🎹 Jazz Keys',
    description: '即兴爵士风格',
    code: `// 🎹 Jazz Keys
setcps(0.4)

// 🥁 Swing 鼓
$: s("bd ~ [~ bd] ~, ~ sd ~ [~ sd], [hh hh hh]*2")
  .gain("0.8 0.5 0.7 0.6")
  ._pianoroll({labels:1})

// 🎹 爵士和弦
$: note("<[d3,f3,a3,c4] [g3,b3,d4,f4] [c3,e3,g3,b3] [a2,c3,e3,g3]>")
  .s("superpiano")
  .gain(0.35)
  .room(0.5)
  ._pianoroll()

// 🎷 即兴旋律
$: n("0 2 4 5 7 9 11 12")
  .scale("C:dorian")
  .s("pluck")
  .sometimes(x => x.speed(1.5))
  .gain(0.3)
  .room(0.4)
  ._pianoroll({labels:1})`,
  },
  {
    name: '🌊 Drum & Bass',
    description: '快节奏 DnB',
    code: `// 🌊 Drum & Bass
setcps(0.7)

// 🥁 快速碎拍
$: s("bd ~ ~ bd, ~ [~ sd] ~ sd, hh*16")
  .bank("RolandTR808")
  .gain("1 0.7 0.8 0.9")
  ._pianoroll({labels:1})

// 🎸 Reese Bass
$: note("<c2 c2 [eb2 f2] c2>")
  .s("sawtooth")
  .lpf(sine.range(200, 800).slow(4))
  .gain(0.6)
  .distort(0.15)
  ._scope({smear:0.5})

// ✨ Pad 氛围
$: note("<[c4,eb4,g4] [f4,ab4,c5]>")
  .s("sine")
  .room(0.8)
  .gain(0.2)
  .slow(2)
  ._scope({smear:0.9})`,
  },
  {
    name: '🎮 Chiptune',
    description: '复古游戏音乐风格',
    code: `// 🎮 Chiptune
setcps(0.55)

// 🥁 简洁节拍
$: s("bd sd bd [sd sd]")
  .gain(0.8)
  .crush(8)
  ._pianoroll({labels:1})

// 🎹 主旋律
$: note("c5 e5 g5 c6 b5 g5 e5 d5")
  .s("square")
  .gain(0.35)
  .crush(6)
  .lpf(4000)
  ._pianoroll({labels:1})

// 🎵 低音
$: note("<c3 f3 g3 c3>")
  .s("triangle")
  .gain(0.5)
  ._scope()

// ✨ 琶音
$: note("c4 e4 g4 c5".fast(2))
  .s("square")
  .gain(0.2)
  .crush(8)
  .pan(sine)
  ._scope({smear:0.5})`,
  },
  {
    name: '🌸 Future Bass',
    description: '柔和的 Future Bass',
    code: `// 🌸 Future Bass
setcps(0.5)

// 🥁 节拍
$: s("bd ~ bd ~, ~ sd ~ sd, hh*8")
  .gain("0.9 0.7 0.8 0.7")
  ._pianoroll({labels:1})

// 🎹 超级锯齿波和弦
$: note("<[c4,e4,g4,b4] [a3,c4,e4,g4] [f3,a3,c4,e4] [g3,b3,d4,f4]>")
  .s("supersaw")
  .lpf(sine.range(1000, 5000).slow(8))
  .room(0.4)
  .gain(0.3)
  ._pianoroll()

// 🔊 Sub Bass
$: note("<c1 a0 f1 g1>")
  .s("sine")
  .gain(0.6)
  ._scope({smear:0.8})

// ✨ 铃声点缀
$: n("0 4 7 11")
  .scale("C:major")
  .s("glockenspiel")
  .gain(0.25)
  .room(0.6)
  .degrade()
  ._pianoroll({labels:1})`,
  },
  {
    name: '🎭 Experimental',
    description: '实验性电子音乐',
    code: `// 🎭 Experimental
setcps(0.45)

// 🫧 Glitch 节拍
$: s("bd [~ bd:2]*2, sd:3 ~ [cp cp] ~")
  .every(3, x => x.speed(rand.range(0.5, 2)))
  .gain(0.7)
  ._pianoroll({labels:1})

// 🌀 扭曲音色
$: note("c3 eb3 f3 g3")
  .s("sawtooth")
  .lpf(cosine.range(200, 4000).fast(3))
  .vowel("<a e i o>")
  .gain(0.35)
  .room(0.5)
  ._scope()

// 🔮 噪声纹理
$: s("hh*16")
  .speed(rand.range(0.1, 3))
  .gain(0.15)
  .pan(rand)
  .crush(sine.range(3, 12).slow(4))
  ._spectrum()`,
  },
  {
    name: '🎄 Minimal Techno',
    description: '极简 Techno',
    code: `// 🎄 Minimal Techno
setcps(0.54)

// 🥁 稳定四拍
$: s("bd*4")
  .gain(0.9)
  ._pianoroll({labels:1})

// 🎩 镲片律动
$: s("[~ hh]*4, ~ oh ~ ~")
  .gain("0.5 0.7 0.6 0.8")
  ._scope()

// 🪇 Rimshot Loop
$: s("~ rim ~ [rim rim]")
  .gain(0.4)
  .every(4, x => x.fast(2))
  .pan(sine.slow(3))
  ._pianoroll()

// 🔊 Deep Bass
$: note("c2 ~ c2 ~")
  .s("sine")
  .gain(0.65)
  .lpf(200)
  ._scope({smear:0.7})`,
  },
  {
    name: '⚡️ User Test Music',
    description: '复杂音轨测试与交互 Slider 展示',
    code: `// ⚡️ User Test Music
setcpm(138/4)

// 我们现在有了 UI Sliders!
const drive = slider(0.2, 0, 1)
const bassCutoff = slider(800, 200, 5000)

// 🥁 鼓组部分
$kick: s("bd:1!4")
  .duck(2, 0.05, 0.6) // orbit, attack, depth
  .distort(drive).gain(1.2)
  ._scope()

$chh: s("hh:1!4")
  .velocity(".2 .3 .8 .7").fast(4)
  ._punchcard()

$ohh: s("oh:1!4")
  .velocity("0 0 1 0").fast(4).decay(.3)
  ._punchcard()

// 🔉 低音部分 (受 Slider 控制)
$bass: note("~ g1 g2 g1")
  .s("square")
  .fast(8).decay(.1).orbit(2)
  .cutoff(bassCutoff)
  ._pianoroll()

// 🎹 旋律部分
$lead: note("<g3 d4 <f4 c4 f4 c4 g4 ~>>")
  .s("supersaw").detune(.5).gain(0.6)
  .fast(16).release(.04).orbit(2)
  ._pianoroll()`,
  },
];
