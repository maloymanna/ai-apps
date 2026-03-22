export interface SummaryRequest {
  url: string;
}

export interface SummaryResponse {
  success: boolean;
  summary?: string;
  error?: string;
}

export interface ExportOptions {
  format: 'text' | 'pdf';
  filename: string;
}