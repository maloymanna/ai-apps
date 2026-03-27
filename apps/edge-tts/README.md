# edge-tts

*An extension to read aloud webpages using Text-to-Speech for Microsoft Edge browser on Linux Ubuntu*

- Simple UI with play/pause toggle and stop controls.
- Support for 5 languages*: English, French, Spanish, Bengali, Hindi. 
- Uses installed Microsoft voices: Jenny/Aria(en),Vivienne/Henri(fr),Pablo/Raul(es), Bashkar/Nabanita(bn), Swara/Madhur(hi).  
- No AI models/LLM used.

## Prerequisites

- Have Microsoft Edge browser installed on Linux Ubuntu. (Go to http://microsoft.com/en-us/edge to download).  
This will normally download the Microsoft Edge TTS voices. See https://speech.microsoft.com/portal/voicegallery for samples.  

## Setup

**Folder structure**
```text
edge-tts/
	├── background.js
	├── content.js
	├── icons/
	│  ├── readaloud128.png
	│  ├── readaloud16.png
	│  └── readaloud48.png
	├── manifest.json
	├── popup.html
	├── popup.js
	└── styles.css
```
1. Type `edge://extensions/` in Edge address bar to open the Extensions settings
2. Enable `Developer mode`
3. Click `Load unpacked` and select the edge-tts folder. Enable the extension.
4. Preferably pin the extension for easy access (Settings > Manage Extensions > Pin to toolbar) 
5. Click on Extension icon in the toolbar, and hit Play icon

## Optional improvements

- Improve text parsing with chunking or with Mozilla readability library
- Add voice and language selectors, speech and pitch controls with a settings option in the UI
  
* Note: Edge-TTS has multiple languages, but I could test only those that I speak personally.

