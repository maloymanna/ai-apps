#!/usr/bin/env python3
"""
Simple Web Page Summarizer
A tool to summarize web pages and save results to both console and file.
- Uses BeautifulSoup for text extraction
- Uses NLTK tokenize for sentence and word tokenization
"""

import argparse
import requests
from bs4 import BeautifulSoup
import nltk
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.corpus import stopwords
import string
import os
import sys

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')
    
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

def clean_text(text):
    """Clean and normalize text"""
    # Remove extra whitespace
    text = ' '.join(text.split())
    return text

def extract_article_text(url):
    """Extract main article text from a web page"""
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
        
        # Try to find main content (common selectors)
        main_selectors = [
            'article', 'main', '.content', '.post', '.entry', 
            '.article-content', '.main-content', '#content'
        ]
        
        main_content = None
        for selector in main_selectors:
            element = soup.select_one(selector)
            if element:
                main_content = element
                break
        
        # If no specific selector found, use body but exclude nav, header, footer
        if not main_content:
            body = soup.find('body')
            if body:
                # Remove navigation, header, footer elements
                for element in body.find_all(['nav', 'header', 'footer', 'aside']):
                    element.decompose()
                main_content = body
        
        if main_content:
            text = main_content.get_text(separator=' ', strip=True)
            return clean_text(text)
        else:
            return clean_text(soup.get_text(separator=' ', strip=True))
            
    except requests.RequestException as e:
        raise Exception(f"Failed to fetch URL: {e}")
    except Exception as e:
        raise Exception(f"Error parsing web page: {e}")

def summarize_text(text, num_sentences=5):
    """Create a simple extractive summary"""
    if not text or len(text.strip()) < 100:
        return text
    
    try:
        # Tokenize sentences
        sentences = sent_tokenize(text)
        if len(sentences) <= num_sentences:
            return text
        
        # Tokenize words and remove stopwords
        words = word_tokenize(text.lower())
        stop_words = set(stopwords.words('english'))
        words = [word for word in words if word.isalnum() and word not in stop_words]
        
        # Calculate word frequency
        word_freq = {}
        for word in words:
            word_freq[word] = word_freq.get(word, 0) + 1
        
        # Score sentences based on word frequency
        sentence_scores = {}
        for i, sentence in enumerate(sentences):
            words_in_sentence = word_tokenize(sentence.lower())
            score = 0
            for word in words_in_sentence:
                if word in word_freq and word.isalnum():
                    score += word_freq[word]
            sentence_scores[i] = score
        
        # Get top sentences
        top_sentences = sorted(sentence_scores.items(), key=lambda x: x[1], reverse=True)[:num_sentences]
        top_sentence_indices = [idx for idx, score in top_sentences]
        top_sentence_indices.sort()
        
        # Build summary
        summary = ' '.join([sentences[i] for i in top_sentence_indices])
        return summary
        
    except Exception as e:
        # If summarization fails, return first few sentences
        sentences = sent_tokenize(text)
        return ' '.join(sentences[:min(5, len(sentences))])

def save_summary_to_file(summary, url, filename=None):
    """Save summary to a file"""
    if not filename:
        # Create a safe filename from URL
        domain = url.split('//')[-1].split('/')[0].replace('www.', '')
        safe_domain = ''.join(c for c in domain if c.isalnum() or c in ('-', '.'))
        filename = f"summary_{safe_domain}.txt"
    
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f"URL: {url}\n")
            f.write("=" * 50 + "\n\n")
            f.write(summary)
        return filename
    except Exception as e:
        raise Exception(f"Failed to save summary to file: {e}")

def main():
    parser = argparse.ArgumentParser(
        description="Summarize web pages",
        epilog="Example: python web_summarizer.py https://example.com",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('url', help="URL of the web page to summarize")
    parser.add_argument('-o', '--output', help="Output filename (optional)")
    parser.add_argument('-s', '--sentences', type=int, default=5, 
                       help="Number of sentences in summary (default: 5)")
    
    args = parser.parse_args()
    
    print(f"📄 Processing URL: {args.url}")
    print("⏳ Please wait while fetching and summarizing content...")
    
    try:
        # Extract text from web page
        article_text = extract_article_text(args.url)
        
        if not article_text or len(article_text.strip()) < 50:
            print("❌ Error: Could not extract meaningful content from the web page.")
            print("The page might be empty, require login, or have restricted access.")
            sys.exit(1)
        
        # Generate summary
        summary = summarize_text(article_text, args.sentences)
        
        # Display results
        print("\n" + "="*60)
        print("📝 SUMMARY:")
        print("="*60)
        print(summary)
        print("="*60)
        
        # Save to file
        output_file = save_summary_to_file(summary, args.url, args.output)
        print(f"\n💾 Summary saved to: {output_file}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\nPlease check:")
        print("- The URL is correct and accessible")
        print("- The website allows automated access")
        print("- You have an internet connection")
        sys.exit(1)

if __name__ == "__main__":
    main()