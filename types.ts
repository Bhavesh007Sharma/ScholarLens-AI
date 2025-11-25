
export enum LoadingState {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  INDEXING = 'INDEXING', // New state for Vector RAG
  ANALYZING = 'ANALYZING',
  READY = 'READY',
  ERROR = 'ERROR'
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model'
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  image?: string; // For visual analysis history
  isThinking?: boolean;
  steps?: string[]; // To show agent actions (e.g. "Searching Semantic Scholar...")
  groundingChunks?: GroundingChunk[];
}

export interface InsightConcept {
  concept: string;
  description: string;
  relatedTo: string[];
}

export interface PaperInsights {
  title: string;
  summary: string;
  outline: string[];
  keyPoints: string[];
  concepts: InsightConcept[];
}

// RAG Types
export interface VectorChunk {
  id: string;
  text: string;
  vector: number[];
  pageNumber: number;
}

export interface PaperData {
  fileName: string;
  fullText: string; // Kept for fallback
  pageCount: number;
  vectorStore?: VectorChunk[]; // The "Long Term Memory"
}
