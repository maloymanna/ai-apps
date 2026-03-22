import './styles.css';

class WebSummarizerApp {
  private urlInput: HTMLInputElement;
  private submitButton: HTMLButtonElement;
  private summaryContainer: HTMLElement;
  private loadingSpinner: HTMLElement;
  private exportButtons: NodeListOf<HTMLElement>;
  private resetButton: HTMLElement;

  constructor() {
    this.urlInput = document.getElementById('url-input') as HTMLInputElement;
    this.submitButton = document.getElementById('submit-btn') as HTMLButtonElement;
    this.summaryContainer = document.getElementById('summary-container')!;
    this.loadingSpinner = document.getElementById('loading-spinner')!;
    this.exportButtons = document.querySelectorAll('.export-btn');
    this.resetButton = document.getElementById('reset-btn')!;

    this.initializeEventListeners();
    console.log("WebSummarizerApp initialized"); // Debug log
  }

  private initializeEventListeners(): void {
    this.submitButton.addEventListener('click', () => this.handleSummarize());
    this.resetButton.addEventListener('click', () => this.handleReset());

    // Add export event listeners
    document.getElementById('export-text')?.addEventListener('click', () => 
      this.handleExport('text')
    );
    document.getElementById('export-pdf')?.addEventListener('click', () => 
      this.handleExport('pdf')
    );
  }

  private handleReset(): void {
    // Clear the summary area and URL input
    this.urlInput.value = '';
    this.summaryContainer.innerHTML = '<p>Your summary will appear here...</p>';
    
    // Hide export buttons
    const exportSection = document.getElementById('export-section');
    if (exportSection) {
      exportSection.style.display = 'none';
    }
  }

  private async handleSummarize(): Promise<void> {
    console.log("Summarize button clicked"); // Debug log
    
    const url = this.urlInput.value.trim();
    
    if (!this.isValidUrl(url)) {
      console.error("Invalid URL:", url); // Debug log
      this.showError('Please enter a valid URL');
      return;
    }

    console.log("Valid URL:", url); // Debug log
    this.setLoadingState(true);
    this.hideError();

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
      console.log("Response data:", data); // Debug log

      if (data.success) {
        console.log("Summary received successfully"); // Debug log
        this.displaySummary(data.summary);
        this.showExportButtons();
      } else {
        console.error("API error:", data.error); // Debug log
        this.showError(data.error || 'Failed to summarize page');
      }
    } catch (error) {
      console.error('Network error:', error); // Debug log
      this.showError('Network error: Could not reach the server. Please check if the backend is running.');
    } finally {
      this.setLoadingState(false);
    }
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
  }

  private showError(message: string): void {
    this.summaryContainer.innerHTML = `<div class="error-message">${message}</div>`;
    // Show the export section but disable export buttons
    this.showExportSectionWithDisabledExports();
  }

  private showExportSectionWithDisabledExports(): void {
    const exportSection = document.getElementById('export-section');
    if (exportSection) {
      exportSection.style.display = 'flex';
      // Disable export buttons but keep reset active
      const exportTextBtn = document.getElementById('export-text') as HTMLButtonElement;
      const exportPdfBtn = document.getElementById('export-pdf') as HTMLButtonElement;
      if (exportTextBtn) exportTextBtn.disabled = true;
      if (exportPdfBtn) exportPdfBtn.disabled = true;
    }
  }

  private hideError(): void {
    const errorEl = this.summaryContainer.querySelector('.error-message');
    if (errorEl) {
      errorEl.remove();
      // Re-enable export buttons if they were disabled due to error
      const exportTextBtn = document.getElementById('export-text') as HTMLButtonElement;
      const exportPdfBtn = document.getElementById('export-pdf') as HTMLButtonElement;
      if (exportTextBtn) exportTextBtn.disabled = false;
      if (exportPdfBtn) exportPdfBtn.disabled = false;
    }
  }

  private showExportButtons(): void {
    const exportSection = document.getElementById('export-section');
    if (exportSection) {
      exportSection.style.display = 'flex';
      // Re-enable export buttons if they were disabled due to error
      const exportTextBtn = document.getElementById('export-text') as HTMLButtonElement;
      const exportPdfBtn = document.getElementById('export-pdf') as HTMLButtonElement;
      if (exportTextBtn) exportTextBtn.disabled = false;
      if (exportPdfBtn) exportPdfBtn.disabled = false;
    }
  }

  private handleExport(format: 'text' | 'pdf'): void {
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
      // Dynamically import jsPDF only when needed
      //const jsPDF = await import('jspdf').then(module => module.jsPDF);
      const { jsPDF } = await import(/* webpackChunkName: "jspdf" */ 'jspdf');
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(12);
      // Split long URL into multiple lines
      const wrappedUrl = doc.splitTextToSize(`URL: ${url}`, 180);
      doc.text(wrappedUrl, 10, 10);
      
      // Add content with automatic line breaks
      doc.setFontSize(10);
      const splitText = doc.splitTextToSize(content, 180);
      doc.text(splitText, 10, 30);
      
      doc.save(`summary-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
      // Fallback to text export
      console.warn('PDF export failed, falling back to text export');
      this.exportAsText(content, url);
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM loaded, initializing app"); // Debug log
  new WebSummarizerApp();
});