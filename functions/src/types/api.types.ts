/**
 * TypeScript types for API requests and responses
 */

export interface AnalyzeRequest {
  query: string;
}

export interface AnalyzeResponse {
  visualizationSpec?: {
    type: string;
    data: any;
    options: any;
  };
  insights: string[];
  recommendations: string[];
  needsClarification: boolean;
  clarificationQuestion?: string;
}

