import os
import re
import sys
import threading
import traceback
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["chrome-extension://*"])

OUTPUT_DIR = Path(os.environ.get('YT_SUMMARIES_DIR', Path.home() / 'yt_summaries'))
print(OUTPUT_DIR)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = OUTPUT_DIR / 'runs.log'
print(LOG_FILE)

# Limits
MAX_WORDS = 14400   # ~90 min @ avg 160 wpm
MAX_CHUNK_WORDS = 700  # safe below BART's 1024-token window (~700 words * 1.3 tok/word = 910)

job_store = {}
model_cache = {}

def log(msg):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with LOG_FILE.open('a', encoding='utf-8') as f:
            f.write(line + '\n')
    except Exception:
        pass

def get_summarizer():
    if 'pipe' not in model_cache:
        from transformers import pipeline
        log("Loading DistilBART model (first run downloads ~800MB)…")
        model_cache['pipe'] = pipeline(
            "text2text-generation",
            model="sshleifer/distilbart-cnn-12-6",
            device=-1,
        )
        log("Model ready.")
    return model_cache['pipe']

def fetch_transcript(video_id):
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api._errors import NoTranscriptFound

    api = YouTubeTranscriptApi()
    try:
        fetched = api.fetch(video_id, languages=['en', 'en-US', 'en-GB'])
    except NoTranscriptFound:
        try:
            fetched = api.list(video_id).find_generated_transcript(['en']).fetch()
        except NoTranscriptFound:
            fetched = next(iter(api.list(video_id))).fetch()
    return ' '.join(snippet.text for snippet in fetched)

def chunk_text(text, max_words=MAX_CHUNK_WORDS):
    """Split on sentence boundaries, keeping each chunk under max_words."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks, current, current_len = [], [], 0
    for s in sentences:
        wc = len(s.split())
        # Single sentence longer than limit: hard-split by words
        if wc > max_words:
            words = s.split()
            for i in range(0, len(words), max_words):
                chunks.append(' '.join(words[i:i + max_words]))
            continue
        if current_len + wc > max_words and current:
            chunks.append(' '.join(current))
            current, current_len = [], 0
        current.append(s)
        current_len += wc
    if current:
        chunks.append(' '.join(current))
    return chunks

def run_summarizer(summarizer, text):
    """Run summarizer with truncation enabled to prevent token overflow."""
    result = summarizer(
        text,
        max_length=130,
        min_length=30,
        do_sample=False,
        truncation=True,        # ← prevents "index out of range" on long inputs
        clean_up_tokenization_spaces=True,
    )
    return result[0]['generated_text']

def summarize_job(video_id):
    url = f"https://www.youtube.com/watch?v={video_id}"
    job_store[video_id] = {'status': 'running', 'message': 'Fetching transcript…'}
    log(f"START {url}")
    try:
        text = fetch_transcript(video_id)
        word_count = len(text.split())
        log(f"Transcript: {word_count} words")

        if word_count < 50:
            raise ValueError("Transcript too short to summarize (< 50 words).")
        if word_count > MAX_WORDS:
            raise ValueError(
                f"Video too long: transcript is {word_count:,} words "
                f"(~{word_count//160} min). Limit is {MAX_WORDS:,} words (~90 min)."
            )

        job_store[video_id]['message'] = 'Loading AI model…'
        summarizer = get_summarizer()

        chunks = chunk_text(text)
        log(f"Chunks: {len(chunks)}")

        summaries = []
        for i, chunk in enumerate(chunks):
            job_store[video_id]['message'] = f'Summarizing part {i+1} of {len(chunks)}…'
            summaries.append(run_summarizer(summarizer, chunk))

        final = ' '.join(summaries)
        # If many chunks produced a long combined summary, condense once more
        if len(summaries) > 1 and len(final.split()) > 200:
            job_store[video_id]['message'] = 'Condensing final summary…'
            final = run_summarizer(summarizer, final)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        out_file = OUTPUT_DIR / f"yt.summary.{video_id}.{timestamp}.txt"
        generated_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        out_file.write_text(
            f"URL      : {url}\n"
            f"Generated: {generated_at}\n"
            f"{'='*60}\n\n"
            f"{final}\n",
            encoding='utf-8'
        )
        log(f"DONE {out_file}")
        job_store[video_id] = {'status': 'done', 'output_path': str(out_file)}

    except Exception as e:
        traceback.print_exc(file=sys.stdout)
        sys.stdout.flush()
        log(f"ERROR {e}")
        job_store[video_id] = {'status': 'error', 'message': str(e)}

@app.get('/health')
def health():
    return jsonify({'status': 'ok'})

@app.post('/summarize')
def summarize():
    data = request.get_json(silent=True) or {}
    video_id = data.get('video_id', '').strip()
    if not re.match(r'^[\w-]{11}$', video_id):
        return jsonify({'status': 'error', 'message': 'Invalid video ID'}), 400
    if job_store.get(video_id, {}).get('status') == 'running':
        return jsonify({'status': 'running', 'message': 'Already running'})
    threading.Thread(target=summarize_job, args=(video_id,), daemon=True).start()
    return jsonify({'status': 'running', 'message': 'Job started'})

@app.get('/status')
def status():
    video_id = request.args.get('video_id', '').strip()
    return jsonify(job_store.get(video_id, {'status': 'unknown'}))

if __name__ == '__main__':
    log(f"Output dir: {OUTPUT_DIR}")
    log(f"Listening : http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=False)
