
import { GoogleGenAI } from "@google/genai";
import { VectorChunk } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// 1. Chunking Strategy
const CHUNK_SIZE = 1000; // Characters approx
const OVERLAP = 200;

function chunkText(text: string): { text: string; page: number }[] {
  const chunks: { text: string; page: number }[] = [];
  
  // Naive splitting by page marker (assuming format from pdfUtils)
  const pages = text.split(/--- Page (\d+) ---/);
  
  for (let i = 1; i < pages.length; i += 2) {
    const pageNum = parseInt(pages[i]);
    const pageContent = pages[i + 1];
    
    // Sub-chunking large pages
    let start = 0;
    while (start < pageContent.length) {
      const end = Math.min(start + CHUNK_SIZE, pageContent.length);
      chunks.push({
        text: pageContent.slice(start, end),
        page: pageNum
      });
      start += (CHUNK_SIZE - OVERLAP);
    }
  }
  return chunks;
}

// 2. Embedding Generation
export const createVectorStore = async (fullText: string): Promise<VectorChunk[]> => {
  const rawChunks = chunkText(fullText);
  const vectorStore: VectorChunk[] = [];

  // Batch requests to avoid rate limits (simple sequential for demo)
  for (const chunk of rawChunks) {
    // Skip empty chunks
    if (chunk.text.trim().length < 50) continue;

    try {
      const response = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: { parts: [{ text: chunk.text }] }
      });

      if (response.embeddings?.[0]?.values) {
        vectorStore.push({
          id: `${chunk.page}-${Date.now()}-${Math.random()}`,
          text: chunk.text,
          vector: response.embeddings[0].values,
          pageNumber: chunk.page
        });
      }
    } catch (e) {
      console.warn("Failed to embed chunk", e);
    }
  }

  return vectorStore;
};

// 3. Retrieval (Cosine Similarity)
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const retrieveRelevantChunks = async (query: string, store: VectorChunk[], topK: number = 5): Promise<VectorChunk[]> => {
  if (!store || store.length === 0) return [];

  // Embed the query
  const response = await ai.models.embedContent({
    model: "text-embedding-004",
    contents: { parts: [{ text: query }] }
  });

  const queryVector = response.embeddings?.[0]?.values;
  if (!queryVector) return [];

  // Rank chunks
  const scored = store.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(queryVector, chunk.vector)
  }));

  // Sort descending
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
};
