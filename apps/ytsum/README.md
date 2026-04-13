# ytsum
*An extension to summarize YouTube videos without AI LLM, for Microsoft Edge browser on Linux Ubuntu*

- A simple Python-based YouTube video summarizer web extension
- Uses youtube-transcript-api to get YouTube transcripts
- Uses DistilBART for summarization with safe chunking
- Word/time limit: 14,400 words (~ 90 min)
- Exports summary to local and keeps run log
- No cloud LLM/ API key required, intended for local use.

## Setup

**Project Structure**

```text
ytsum/
	├── background.js
	├── content.js
	├── icon.png
	├── manifest.json
	├── popup.html
	├── popup.js
	├── README.md
	├── server/
	│  ├── requirements.txt
	│  └── server.py
	├── start_server.sh*
	└── yt_summaries/ 			[generated]

```

1. Run the start_server.sh to start the local Flask server on http://127.0.0.1:5000
2. Type edge://extensions/ in Edge address bar to open the Extensions settings
3. Enable Developer mode
4. Click Load unpacked and select the ytsum folder. Enable the extension.
5. Preferably pin the extension for easy access (Settings > Manage Extensions > Pin to toolbar)
6. Click on Extension icon in the toolbar. If on YouTube page, hit the Summarize button directly, else enter the video URL before clicking on Summarize.

## Optional improvements

- [ ] Use a local LLM to improve performance
- [ ] Allow option to use a cloud LLM with API key
