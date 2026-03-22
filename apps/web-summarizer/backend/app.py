from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask import send_from_directory
import requests
from bs4 import BeautifulSoup
import os
from urllib.parse import urlparse
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
import configparser
import importlib
from dotenv import load_dotenv
import re

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# Load configuration
config = configparser.ConfigParser()
config.read('config/models.ini')

# Serve the main page
@app.route('/')
def index():
    return send_from_directory('../frontend/dist', 'index.html')

# Serve any other static files
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend/dist', path)

def get_available_provider():
    """Find the first available LLM provider based on environment variables"""
    for section_name in config.sections():
        if section_name == 'DEFAULT':
            continue
        
        env_var = config[section_name]['api_key_env']
        if os.getenv(env_var):
            return section_name
    
    raise Exception("No supported LLM API key found in environment variables")

def create_llm_client(provider):
    """Create and return the appropriate LLM client based on provider"""
    provider_config = config[provider]
    api_key_env = provider_config['api_key_env']
    api_key = os.getenv(api_key_env)
    
    print(f"Provider: {provider}")  # Debug
    print(f"API Key env var: {api_key_env}")  # Debug
    print(f"API Key value: {api_key[:5] if api_key else None}")  # Debug (show only first 5 chars)

    if not api_key:
        raise Exception(f"No API key found for {provider}")
    
    match provider_config['client_type']:
        case 'openai':
            import openai
            client = openai.OpenAI(api_key=api_key)
            
            # Set base URL if provided (for OpenRouter)
            if 'base_url' in provider_config:
                client.base_url = provider_config['base_url']
            
            return client, provider_config
        
        case 'mistral':
            from mistralai.client import MistralClient
            return MistralClient(api_key=api_key), provider_config
        
        case 'gemini':
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model_name = provider_config['model']
            return genai.GenerativeModel(model_name), provider_config
        
        case _:
            raise Exception(f"Unsupported client type: {provider_config['client_type']}")

def summarize_with_llm(text_content):
    """Use configured LLM to generate a summary of the text"""
    provider = get_available_provider()
    client, provider_config = create_llm_client(provider)

    # Use provider-specific max tokens or default to 1000
    max_tokens = int(provider_config.get('max_tokens', '1000'))

    # Calculate max input length based on model capabilities
    # Most models have ~128k token limits, but we'll use a conservative approach
    max_input_length = max_tokens * 4  # Rough estimate: 1 token ≈ 4 chars
    if len(text_content) > max_input_length:
        text_content = text_content[:max_input_length]
    
    ## Truncate text if it's too long for the model
    #max_input_length = 120000
    #if len(text_content) > max_input_length:
    #    text_content = text_content[:max_input_length]
    
    systemprompt = "You are a helpful assistant."
    prompt = f"""
    Summarize in plain text ONLY in 100 words the following text. Ignore all images, videos, audios, header, footer, navigation elements.
    Do NOT include any HTML, markdown, images, icons or links in your response.
    
    TEXT CONTENT:
    {text_content}
    
    SUMMARY:
    """
    
    print(f"Sending prompt with {len(text_content)} characters to {provider}")  # Debug log

    match provider_config['client_type']:
        case 'openai':
            response = client.chat.completions.create(
                model=provider_config['model'],
                messages=[
                    {"role": "system", "content": systemprompt},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=int(provider_config['max_tokens']),
                temperature=float(provider_config.get('temperature', '0.7'))
            )

            # Handle different response formats
            if hasattr(response, 'choices') and response.choices:
                summary = response.choices[0].message.content
            else:
                # Fallback for different response structures
                summary = str(response)            
            
        case 'mistral':
            from mistralai.models.chat_completion import ChatMessage
            messages = [
                ChatMessage(role="system", content=systemprompt),
                ChatMessage(role="user", content=prompt)
            ]
            chat_response = client.chat(
                model=provider_config['model'],
                messages=messages,
                max_tokens=int(provider_config['max_tokens'])
            )
            summary = chat_response.choices[0].message.content
            
        case 'gemini':
            response = client.generate_content(prompt)
            summary = response.text
            
        case _:
            raise Exception(f"Unsupported client type: {provider_config['client_type']}")
    
    #print(repr(response['summary'])) # Debug log

    # Ensure proper paragraph formatting
    paragraphs = [p.strip() for p in summary.split('\n') if p.strip()]
    formatted_summary = '\n\n'.join(paragraphs)
    
    print(f"Final summary length: {len(formatted_summary)} characters")  # Debug log
    return formatted_summary

def extract_text_from_url(url):
    """Extract clean text content from a URL"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Get text content
        text = soup.get_text()
        
        # Clean up text
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        return text
    except Exception as e:
        raise Exception(f"Error extracting content from URL: {str(e)}")


@app.route('/api/summarize', methods=['POST'])
def summarize():
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        
        print(f"Received URL: {url}")  # Debug log

        if not url:
            return jsonify({'success': False, 'error': 'URL is required'}), 400
        
        # Validate URL format
        parsed_url = urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            return jsonify({'success': False, 'error': 'Invalid URL format'}), 400
        
        # Extract text from URL
        print("Extracting text from URL...")  # Debug log
        text_content = extract_text_from_url(url)
        print(f"Extracted content length: {len(text_content)} characters")  # Debug log
        
        if not text_content:
            return jsonify({'success': False, 'error': 'Could not extract content from the URL'}), 400
        
        # Find and print which provider is being used
        provider = get_available_provider()
        print(f"Using provider: {provider}")  # Debug log
        print(f"API Key for {provider}: {'SET' if os.getenv(config[provider]['api_key_env']) else 'NOT SET'}")  # Debug log

        # Generate summary using configured LLM
        print("Generating summary...")  # Debug log
        summary = summarize_with_llm(text_content)
        print(f"Generated summary length: {len(summary)} characters")  # Debug log

        return jsonify({
            'success': True,
            'summary': summary
        })
    
    except requests.exceptions.RequestException as e:
        print(f"Request error: {str(e)}")  # Debug log
        return jsonify({'success': False, 'error': f'Request error: {str(e)}'}), 400
    except Exception as e:
        print(f"General error: {str(e)}")  # Debug log
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/export/text', methods=['POST'])
def export_text():
    try:
        data = request.get_json()
        content = data.get('content', '')
        filename = data.get('filename', 'summary.txt')
        
        # Create a text file in memory
        buffer = io.StringIO()
        buffer.write(content)
        buffer.seek(0)
        
        # Convert to bytes for response
        content_bytes = buffer.getvalue().encode('utf-8')
        buffer.close()
        
        # Send as downloadable file
        return send_file(
            io.BytesIO(content_bytes),
            as_attachment=True,
            download_name=filename,
            mimetype='text/plain'
        )
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    # Check if any supported LLM API key is set
    available_providers = []
    for section_name in config.sections():
        if section_name == 'DEFAULT':
            continue
        env_var = config[section_name]['api_key_env']
        if os.getenv(env_var):
            available_providers.append(section_name)
    
    if not available_providers:
        print("Warning: No supported LLM API key found in environment variables")
        print("Supported providers:", list(config.sections()))
        print("Check your .envrc file for:")
        for section_name in config.sections():
            if section_name != 'DEFAULT':
                print(f"- {config[section_name]['api_key_env']}")
    
    app.run(debug=True, host='0.0.0.0', port=5000)