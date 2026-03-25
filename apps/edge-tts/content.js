if (!window.__edge_tts_injected__) {
  window.__edge_tts_injected__ = true;

  const state = window.__edge_tts_state__ = window.__edge_tts_state__ || {
    utterance: null,
    voices: []
  };

  function getPageLanguage() {
    // 1. Try to get language from the HTML tag (e.g., <html lang="fr">)
    const htmlLang = document.documentElement.lang || "";
    
    // 2. Fallback to browser language if not found
    const navLang = navigator.language || "";

    const lang = (htmlLang || navLang).toLowerCase();
    
    // Extract the primary code (e.g., "fr" from "fr-CA")
    const primaryLang = lang.split('-')[0];

    // Limit to our supported languages, default to English otherwise
    if (primaryLang === 'fr') return 'fr';
    if (primaryLang === 'es') return 'es';
    return 'en';
  }

  function cleanText(root) {
    const clone = root.cloneNode(true);
    
    // Remove junk elements
    const junkSelectors = [
      "nav", 
      "header",
      "footer",
      "aside",
      "script",
      "style",
      "noscript",
      "form",
      "button",
      "input",
      "svg",
      "canvas",
      "figure",
      "figcaption",
      "[role='navigation']",
      "[aria-hidden='true']",
      ".nav",
      ".menu",
      ".sidebar",
      ".ads",
      ".advert",
      ".cookie",
      ".popup",
      ".modal"
    ];

    junkSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Remove empty blocks only, not inline elements
    clone.querySelectorAll("p, div, section, article").forEach(el => {
      const text = el.innerText.trim();
      if (text.length === 0){
        el.remove();
      }
    });

    // Normalize whitespace
    let text = clone.innerText;

    text = text
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

    return text;
  }

  function getText() {
    // 1. Selection gets priority
    const selection = window.getSelection().toString().trim();
    if (selection.length > 0) return selection;
    
    // 2. Candidate selectors (best to worst)
    const selectors = [
      "main",
      "article",
      "[role='main']",
      ".content",
      "#content",
      ".post",
      ".article",
      ".main"      
    ]
    let bestElement = null;
    let maxLength = 0;

    // 3. Find the longest meaningful content block
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.innerText.trim();
        if (text.length > maxLength && text.length > 200) {
          maxLength = text.length;
          bestElement = el;
        }
      });
    }    

    // 4. Fallback → scan all sections/divs
    if (!bestElement) {
      const blocks = document.querySelectorAll("div, section");

      blocks.forEach(el => {
        const text = el.innerText.trim();
        if (text.length > maxLength && text.length > 500) {
          maxLength = text.length;
          bestElement = el;
        }
      });
    }

    // 5. Final fallback
    if (!bestElement) {
      bestElement = document.body;
    }

    // 6. Clean the content
    return cleanText(bestElement);    
    //return selection.length > 0 ? selection : document.body.innerText;
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

  function pickBestVoice(voices, pageLang) {

    // --- Specific logic for French as auto-selection provides an incorrect accent ---
    if (pageLang === 'fr') {
      // 1. Prioritise French-France locale voice, with the standard voices
      const priorityNeuralNames = [
        "fr-FR-VivienneNeural",
        "fr-FR-HenriNeural",
        "Microsoft Vivienne",
        "Microsoft Henri" 
      ];

      for (const name of priorityNeuralNames) {
        const match = voices.find(v => v.name.includes(name));
        if (match) return match;
      }

      // 2. Strict Locale Check: Look for fr-FR (Exclude CA, CH, BE)
      // We check if lang is exactly "fr-FR" or starts with "fr-FR-"
      const strictFR = voices.find(v => v.lang === "fr-FR" || v.lang.startsWith("fr-FR-"));
      if (strictFR) return strictFR;

      // 3. Fallback: If no fr-FR found at all, use any 'fr' voice available
      const anyFrench = voices.find(v => v.lang.startsWith("fr"));
      if (anyFrench) return anyFrench;
    }      

    // --- Logic for English and Spanish ---
    const voicePreferences = {
      'en': ["Microsoft Jenny", "Microsoft Aria", "Google US English", "en-US"],
      'es': ["Microsoft Pablo", "Microsoft Raul", "Google español", "es-ES"]
    };

    const preferredNames = voicePreferences[pageLang];
    if (preferredNames) {
      for (const name of preferredNames) {
        const match = voices.find(v => v.name.includes(name) || v.lang.includes(name));
        if (match) return match;
      }
    }

    // Ultimate fallback: first available voice
    return voices[0];
  }

  function speak(text, lang = 'en') { // Added lang parameter
    const synth = window.speechSynthesis;

    synth.cancel(); // stop previous

    const utterance = new SpeechSynthesisUtterance(text);

    // Handle reading finishing naturally
    utterance.onend = () => {
      // Send a message back to the extension when reading finishes naturally
      chrome.runtime.sendMessage({ command: "finished" });
    };

    // Pass 'lang' here
    const voice = pickBestVoice(state.voices, lang);
    alert("voice is: " + voice.name)

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

  async function start() {
    const text = getText();
    if (!text) return;

    await loadVoices();
    // 1. Detect language
    const lang = getPageLanguage();
    
    // 2. Pass language to speak
    speak(text, lang);
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