import './styles.css';

class WebSummarizerApp {
  private urlInput: HTMLInputElement;
  private submitButton: HTMLButtonElement;
  private summaryContainer: HTMLElement;
  private loadingSpinner: HTMLElement;
  // Declare the new properties here
  private exportSection: HTMLElement;
  private exportTextBtn: HTMLButtonElement;
  private exportPdfBtn: HTMLButtonElement;
  private resetButton: HTMLButtonElement;

  constructor() {
    this.urlInput = document.getElementById('url-input') as HTMLInputElement;
    this.submitButton = document.getElementById('submit-btn') as HTMLButtonElement;
    this.summaryContainer = document.getElementById('summary-container')!;
    this.loadingSpinner = document.getElementById('loading-spinner')!;
    
    // Initialize the new properties in the constructor
    this.exportSection = document.getElementById('export-section')!;
    this.exportTextBtn = document.getElementById('export-text') as HTMLButtonElement;
    this.exportPdfBtn = document.getElementById('export-pdf') as HTMLButtonElement;
    this.resetButton = document.getElementById('reset-btn') as HTMLButtonElement;

    this.initializeEventListeners();
    
    // Set the initial state when the app is constructed
    this.setStateInitial();
  }

  private initializeEventListeners(): void {
    this.submitButton.addEventListener('click', () => this.handleSummarize());
    this.resetButton.addEventListener('click', () => this.handleReset());

    // Add export event listeners using the stored references
    this.exportTextBtn.addEventListener('click', () => this.handleExport('text'));
    this.exportPdfBtn.addEventListener('click', () => this.handleExport('pdf'));
  }

  private async handleSummarize(): Promise<void> {
    console.log("Summarize button clicked"); // Debug log

    const url = this.urlInput.value.trim();

    if (!this.isValidUrl(url)) {
      console.error("Invalid URL:", url); // Debug log
      this.showError('Please enter a valid URL');
      // Still call setStateFailure or a variant to show the reset button on error
      // Or maybe just ensure the section is visible with disabled buttons handled elsewhere
      // For now, let's ensure the section is visible on error by calling setStateFailure from here
      // But actually, showError should lead to setStateFailure being called explicitly afterwards
      this.setStateFailure(); 
      return;
    }

    console.log("Valid URL:", url); // Debug log
    this.setLoadingState(true);
    this.hideError(); // Clear any previous error display

    try {
      console.log("Sending request to backend..."); // Debug log
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });

      console.log("Response received:", response.status); // Debug log

      const data = await response.json();
      console.log("Response ", data); // Debug log

      if (data.success) {
        console.log("Summary received successfully"); // Debug log
        this.displaySummary(data.summary);
        this.setStateSuccess(); // Set state to success
      } else {
        console.error("API error:", data.error); // Debug log
        this.showError(data.error || 'Failed to summarize page');
        this.setStateFailure(); // Set state to failure
      }
    } catch (error) {
      console.error('Network error:', error); // Debug log
      this.showError('Network error: Could not reach the server. Please check if the backend is running.');
      this.setStateFailure(); // Treat network errors as failures
    } finally {
      this.setLoadingState(false);
    }
  }

  private setStateSuccess(): void {
    this.exportSection.style.display = 'flex'; // Show export section
    this.exportTextBtn.disabled = false; // Enable export buttons
    this.exportPdfBtn.disabled = false; // Enable export buttons
  }

  private setStateFailure(): void {
    this.exportSection.style.display = 'flex'; // Show export section (includes reset)
    this.exportTextBtn.disabled = true; // Disable export buttons
    this.exportPdfBtn.disabled = true; // Disable export buttons
  }

  private setStateInitial(): void {
    this.exportSection.style.display = 'none'; // Hide export section
  }

  private setStateReset(): void {
    this.exportSection.style.display = 'none'; // Hide export section
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private setLoadingState(loading: boolean): void {
    this.submitButton.disabled = loading;
    this.loadingSpinner.style.display = loading ? 'block' : 'none';
  }

  private displaySummary(summary: string): void {
    this.summaryContainer.innerHTML = `
      <div class="summary-content">
        ${summary.split('\n\n').map(paragraph => `<p>${paragraph}</p>`).join('')}
      </div>
    `;
    // State will be set to success by handleSummarize -> setStateSuccess
  }

  private showError(message: string): void {
    this.summaryContainer.innerHTML = `<div class="error-message">${message}</div>`;
    // State will be set to failure by handleSummarize -> setStateFailure
    // Do NOT call setStateFailure here as handleSummarize already manages it
  }

  private hideError(): void {
    const errorEl = this.summaryContainer.querySelector('.error-message');
    if (errorEl) {
      errorEl.remove();
    }
    // Potentially re-enable buttons if summary becomes empty after error removal
    // For now, leave state management to the primary actions
  }

  private handleReset(): void {
    // Clear the summary area
    this.summaryContainer.innerHTML = '<p>Your summary will appear here...</p>';
    // Clear the URL input
    this.urlInput.value = '';
    // Set state to initial/reset state
    this.setStateReset();
  }

  private handleExport(format: 'text' | 'pdf'): void {
    // Check if export buttons are disabled before proceeding
    if ((format === 'text' && this.exportTextBtn.disabled) ||
        (format === 'pdf' && this.exportPdfBtn.disabled)) {
      console.warn(`Cannot export as ${format}, button is disabled.`);
      return;
    }

    const summaryText = this.summaryContainer.textContent || '';
    const url = this.urlInput.value.trim();

    if (!summaryText) {
      alert('No summary available to export');
      return;
    }

    if (format === 'text') {
      this.exportAsText(summaryText, url);
    } else if (format === 'pdf') {
      this.exportAsPdf(summaryText, url);
    }
  }

  private exportAsText(content: string, url: string): void {
    const blob = new Blob([`Summary of: ${url}\n\n${content}`], { type: 'text/plain' });
    const urlObj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlObj;
    a.download = `summary-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(urlObj);
  }

  private async exportAsPdf(content: string, url: string): Promise<void> {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();

      // Add title with smaller font
      doc.setFontSize(12);
      // Split long URL into multiple lines
      const wrappedUrl = doc.splitTextToSize(`URL: ${url}`, 180);
      doc.text(wrappedUrl, 10, 10);

      // Add content with automatic line breaks
      doc.setFontSize(10); // Smaller font for content
      const splitText = doc.splitTextToSize(content, 180);
      // Add vertical spacing after URL
      doc.text(splitText, 10, 30);

      doc.save(`summary-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
      console.warn('PDF export failed, falling back to text export');
      this.exportAsText(content, url);
    }
  }
}

// Initialize app when DOM is loaded - Remove the separate handler
// document.addEventListener('DOMContentLoaded', () => {
//   console.log("DOM loaded, initializing app"); // Debug log
//   const app = new WebSummarizerApp();
//   // Set initial state on load - Now done in constructor
//   // app.setStateInitial(); 
// });

// Instead, initialize the app when the script runs, ensuring DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new WebSummarizerApp();
  });
} else {
  // DOM is already ready
  new WebSummarizerApp();
}