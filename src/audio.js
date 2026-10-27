/* Small synthesized key sounds: no downloaded samples or autoplay. */
(function(root) {
  let context, noise;
  const profiles = {
    thock:{ frequency:170,decay:.075,noise:.10,filter:950 },
    click:{ frequency:950,decay:.035,noise:.18,filter:4900 },
    soft:{ frequency:230,decay:.05,noise:.035,filter:650 },
    pop:{ frequency:440,decay:.08,noise:.055,filter:1700 },
    typewriter:{ frequency:1450,decay:.065,noise:.20,filter:3700 }
  };
  function play(profile = 'thock', low = false) {
    try {
      const Audio = root.AudioContext || root.webkitAudioContext;
      if (!Audio) return;
      context ||= new Audio();
      if (context.state === 'suspended') context.resume().catch(() => {});
      if (!noise) {
        noise = context.createBuffer(1,Math.ceil(context.sampleRate * .1),context.sampleRate);
        const channel = noise.getChannelData(0);
        for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
      }
      const p = profiles[profile] || profiles.thock, now = context.currentTime;
      const oscillator = context.createOscillator(), tone = context.createGain();
      oscillator.frequency.setValueAtTime(p.frequency * (low ? .65 : 1),now);
      oscillator.frequency.exponentialRampToValueAtTime(65,now+p.decay);
      tone.gain.setValueAtTime(.045,now); tone.gain.exponentialRampToValueAtTime(.001,now+p.decay);
      oscillator.connect(tone); tone.connect(context.destination); oscillator.start(now); oscillator.stop(now+p.decay);
      const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
      source.buffer = noise; filter.type = 'lowpass'; filter.frequency.value = p.filter;
      gain.gain.setValueAtTime(p.noise,now); gain.gain.exponentialRampToValueAtTime(.001,now+p.decay);
      source.connect(filter); filter.connect(gain); gain.connect(context.destination);
      source.start(now); source.stop(now+p.decay);
    } catch { /* practice still works when Web Audio is unavailable */ }
  }
  root.GoMayAudio = { play,profiles:Object.keys(profiles) };
})(globalThis);
