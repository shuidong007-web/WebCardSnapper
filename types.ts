
export interface CardData {
  id: string;
  htmlContent: string; // The raw outerHTML of the extracted card
  styles: string; // The extracted CSS content
  loading: boolean;
  error?: string;
  imageUrl?: string; // The captured screenshot URL
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

// Global definition for html2canvas loaded via CDN
declare global {
  interface Window {
    html2canvas: (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>;
  }
}
