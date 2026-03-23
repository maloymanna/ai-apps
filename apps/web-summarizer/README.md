# Web-summarizer

A simple application to summarize a web page using AI and export the output.

- Built using a TypeScript frontend and Python Flask backend
- Web-scraping is done with Python BeautifulSoup
- An AI model is used for summarization via environment variable API key
- Export to text and PDF formats available

## Setup

**Prerequisites**

- Python 3.10+
- Node.js 18+
- API key from a supported provider (Gemini, Groq, Mistral, OpenAI, OpenRouter)

**Folder structure**
```text
web-summarizer/
    ├── backend/
    │  ├── config/
    │  │  └── models.ini
    │  ├── app.py
    │  └── requirements.txt
    ├── frontend/
    │  ├── public/
    │  │  └── index.html
    │  ├── src/
    │  │  ├── index.ts
    │  │  ├── styles.css
    │  │  └── types.ts
    │  ├── package.json
    │  ├── package-lock.json
    │  ├── tsconfig.json
    │  └── webpack.config.js
    └── README.md
```
**Backend setup**
```bash
cd backend
pip install -r requirements.txt
python app.py
```
**Frontend setup**
```bash
cd frontend
npm install
npm run build
```
**Running the application**

1. Setup your API keys for the API in the `.env` file. You can get some free tier API keys at [Groq](https://console.groq.com/home), [Mistral](https://console.mistral.ai/) or [OpenRouter](https://openrouter.ai/workspaces/default/keys)
2. Start the backend server `python app.py`
3. Go to the application at http://localhost:5000 

**API key security, .env & Groq**

- To avoid risk of API keys being exposed, use them as environment variables.
- Export the API keys in `.env` file e.g. `export MISTRAL_API_KEY=api_key`
- Ensure your `.gitignore` file is setup to never upload the `.env` file
- For enhanced safety, you can use `.envrc` file with the API keys stored in secret tool like `pass`, e.g. export MISTRAL_API_KEY=$(pass api/mistral)
- Note that while the above step works for Mistral and OpenRouter, it doesn't for Groq (will throw 401 Invalid API Key error).
- It appears that Groq's Python SDK is unable to do command substitution and requires the actual API key string.
- A workaround to this for Groq is to fetch the API key at runtime in Python using `pass`, even though it makes a special treatment. At least, you won't need to write your API key in plaintext in `.env`.

## Optional improvements

- Deploy to an inference endpoint (ensure API keys are not exposed)
- Add ci pipeline with automated tests
- Enhance to summarize YouTube video transcripts
- Add switch for language translation 