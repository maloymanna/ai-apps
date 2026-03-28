if (!window.__edge_tts_injected__) {
  window.__edge_tts_injected__ = true;
// Word highlighting mods -->
  // --- 1. Inject CSS for Highlighting ---
  const style = document.createElement('style');
  style.textContent = `
    .edge-tts-highlight {
      background-color: yellow;
      color: black;
      border-radius: 2px;
      box-shadow: 0 0 2px rgba(0,0,0,0.5);
      transition: background-color 0.1s;
    }
  `;
  document.head.appendChild(style);
// Word highlighting mods <--
  const state = window.__edge_tts_state__ = window.__edge_tts_state__ || {
    utterance: null,
    voices: [],
    highlightedSpans: [], // Store our wrapped words here
    currentSpanIndex: -1
  };

  function getPageLanguage() {
    // 1. Try to get language from the HTML tag (e.g., <html lang="fr">)
    const htmlLang = document.documentElement.lang || "";
    
    // 2. Fallback to browser language if not found
    const navLang = navigator.language || "";

    const lang = (htmlLang || navLang).toLowerCase();
    
    // Extract the primary code (e.g., "fr" from "fr-CA")
    const primaryLang = lang.split('-')[0];

    // Check for our supported languages, default to English otherwise
    if (primaryLang === 'bn') return 'bn'; // Bengali support
    if (primaryLang === 'hi') return 'hi'; // Hindi support    
    if (primaryLang === 'fr') return 'fr'; // French support
    if (primaryLang === 'es') return 'es'; // Spanish support
    return 'en'; // Default to English
  }

// Word highlighting mods -->
  // Find the best element to read
  function findContentElement() {
    // 1. Check for selection first
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      // Check if the selection is reasonably large (not just a random click)
      if (range.toString().trim().length > 0) {
        console.log("Edge TTS: Reading selected text.");
        return range.commonAncestorContainer; 
        // Note: This might return a text node or element. 
        // wrapWordsInElement handles nodes correctly, but for robustness 
        // with highlights, finding the parent element is safer:
      }
    }

    // 2. Define selectors in order of preference
    const selectors = [
      "main", "article", "[role='main']", ".content", "#content", 
      ".post", ".article", ".main"
    ];

    let bestElement = null;
    let maxLength = 0;

    // 3. Check preferred selectors
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.innerText ? el.innerText.trim() : "";
        // Ignore if it's too short (likely not the main content)
        if (text.length > maxLength && text.length > 200) {
          maxLength = text.length;
          bestElement = el;
        }
      });
    }

    // 4. Fallback: Scan all generic blocks if no main/article found
    if (!bestElement) {
      console.log("Edge TTS: No main selector found, scanning generic blocks...");
      const blocks = document.querySelectorAll("div, section");
      blocks.forEach(el => {
        const text = el.innerText ? el.innerText.trim() : "";
        if (text.length > maxLength && text.length > 500) {
          maxLength = text.length;
          bestElement = el;
        }
      });
    }

    // 5. Final Fallback: Body
    if (!bestElement) {
      console.log("Edge TTS: Using document.body as fallback.");
      bestElement = document.body;
    } else {
      console.log("Edge TTS: Found content element with length:", maxLength);
    }

    return bestElement;
  }

  // Wrap words in spans
  function wrapWordsInElement(element) {
    if (!element) return;

    // Clear previous highlights
    clearHighlights();

    const junkSelectors = [
      "nav", "header", "footer", "aside", "script", "style", "noscript", 
      "form", "button", "input", "svg", "canvas", "figure", "figcaption", 
      "[role='navigation']", "[aria-hidden='true']", ".nav", ".menu", 
      ".sidebar", ".ads", ".advert", ".cookie", ".popup", ".modal", ".ad"
    ];

    // Recursive function to walk the DOM
    function processNode(node) {
      // 1. If it's an Element, check if it's junk
      if (node.nodeType === Node.ELEMENT_NODE) {
        // If element matches junk selector, stop processing this branch
        if (junkSelectors.some(sel => node.matches(sel))) return;

        // Process children
        const children = Array.from(node.childNodes);
        children.forEach(child => processNode(child));
        return;
      }

      // 2. If it's a Text Node, split into words
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue;
        // Skip empty or whitespace-only nodes
        if (!text || !text.trim()) return;

        // Split text by spaces, keeping the spaces
        // Regex: matches one or more whitespace characters OR non-whitespace characters
        const parts = text.split(/(\s+)/); 

        const fragment = document.createDocumentFragment();
        let wordAdded = false;

        parts.forEach(part => {
          if (part.trim().length > 0) {
            // It's a word
            const span = document.createElement('span');
            span.textContent = part;
            span.className = 'edge-tts-word'; // Marker class
            fragment.appendChild(span);
            state.highlightedSpans.push(span); // Add to our tracking array
            wordAdded = true;
          } else {
            // It's whitespace, keep it as text to preserve formatting
            fragment.appendChild(document.createTextNode(part));
          }
        });

        // Replace the original text node with our new fragment
        if (wordAdded) {
          node.parentNode.replaceChild(fragment, node);
        }
      }
    }

    processNode(element);
    console.log("Edge TTS: Wrapped", state.highlightedSpans.length, "words.");
  }

  // Clear Highlights
  function clearHighlights() {
    state.highlightedSpans.forEach(span => {
      span.classList.remove('edge-tts-highlight');
    });
    state.highlightedSpans = [];
    state.currentSpanIndex = -1;
  }  
// Word highlighting mods <--

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

    // --- Logic for other languages BN, HI, ES, EN ---
    const voicePreferences = {
      'en': ["Microsoft Jenny", "Microsoft Aria", "Google US English", "en-US"],
      'bn': ["Microsoft Bashkar", "Microsoft Nabanita", "bn-IN", "bn-BD"],
      'es': ["Microsoft Pablo", "Microsoft Raul", "Google español", "es-ES"],
      'hi': ["Microsoft Swara", "Microsoft Madhur", "hi-IN"]
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
// Word highlighting mods --->
    // Safety check: Ensure we have spans to read
    if (state.highlightedSpans.length === 0) {
      console.warn("Edge TTS: No words found to speak.");
      return;
    }

    // 1. Construct the text string from our wrapped spans
    // We use the textContent of the spans to ensure it matches the DOM exactly
    const textToSpeak = state.highlightedSpans.map(s => s.innerText).join(' ');

    console.log("Edge TTS: Speaking text length:", textToSpeak.length);

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = lang;

    // 2. Highlight Logic
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const charIndex = event.charIndex;
        let currentCount = 0;

        // Find which span corresponds to this character index
        for (let i = 0; i < state.highlightedSpans.length; i++) {
          const span = state.highlightedSpans[i];
          const wordLength = span.innerText.length;

          // Check if the TTS charIndex falls within this word's range
          if (charIndex >= currentCount && charIndex < currentCount + wordLength) {
            
            // Only update DOM if the word has changed
            if (state.currentSpanIndex !== i) {
              // Remove old highlight
              if (state.currentSpanIndex !== -1 && state.highlightedSpans[state.currentSpanIndex]) {
                state.highlightedSpans[state.currentSpanIndex].classList.remove('edge-tts-highlight');
              }

              // Add new highlight
              span.classList.add('edge-tts-highlight');
              state.currentSpanIndex = i;

              // Optional: Scroll to view
              span.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            break;
          }
          // Move counter forward (word length + 1 for the space we added in join(' '))
          currentCount += wordLength + 1;
        }
      }
    };

    // 3. Cleanup on end
    utterance.onend = () => {
      console.log("Edge TTS: Finished reading.");
      clearHighlights();
      chrome.runtime.sendMessage({ command: "finished" });
    };
// Word highlighting mods <---

    const voice = pickBestVoice(state.voices, lang);
    // alert("voice is: " + voice.name)

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
    clearHighlights(); // Word highlighting mods
  }

// Word highlighting mods --->
  async function start() {
    // 1. Find the DOM element
    const element = findContentElement();
    
    if (!element) {
      console.error("Edge TTS: Could not find content element.");
      return;
    }

    // 2. Wrap words in the element
    wrapWordsInElement(element);

    // 3. Load voices and speak
    await loadVoices();
    const lang = getPageLanguage();
    
    // We pass an empty string because speak() ignores it and uses the spans
    speak("", lang);
  }
// Word highlighting mods <---

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