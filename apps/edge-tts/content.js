if (!window.__edge_tts_injected__) {
  window.__edge_tts_injected__ = true;

  const state = window.__edge_tts_state__ = window.__edge_tts_state__ || {
    utterance: null,
    voices: []
  };

  function getText() {
    const selection = window.getSelection().toString().trim();
    return selection.length > 0 ? selection : document.body.innerText;
  }

  function loadVoices() {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;

      const load = () => {
        const voices = synth.getVoices();
        if (voices.length > 0) {
          state.voices = voices;
          resolve(voices);
        }
      };

      if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = load;
      }

      load();
    });
  }

  function pickBestVoice(voices) {
    const tiers = [
      ["Microsoft Jenny", "Microsoft Aria"],        // English
      ["Microsoft Hortense", "Microsoft Elsa"],    // French
      ["Microsoft Pablo", "Microsoft Raul"],       // Spanish
      ["Google UK English", "Google US English"],  // fallback
      ["en-US", "en-GB"]                           // fallback
    ];
    for (const tier of tiers) {
      for (const name of tier) {
        const match = voices.find(v =>
          v.name.includes(name) || v.lang.includes(name)
        );
        if (match) return match;
      }
    }
    return voices[0];
  }

  function speak(text) {
    const synth = window.speechSynthesis;

    synth.cancel(); // stop previous

    const utterance = new SpeechSynthesisUtterance(text);

    const voice = pickBestVoice(state.voices);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    state.utterance = utterance;
    synth.speak(utterance);
  }

  function pause() {
    window.speechSynthesis.pause();
  }

  function resume() {
    window.speechSynthesis.resume();
  }

  function stop() {
    window.speechSynthesis.cancel();
  }

  async function start({ voiceName}) {
    const text = getText();
    if (!text) return;

    await loadVoices();
    speak(text);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.command === "start") {
      start(msg);
    } else if (msg.command === "pause") {
      pause();
    } else if (msg.command === "resume") {
      resume();
    } else if (msg.command === "stop") {
      stop();
    }
  });
}