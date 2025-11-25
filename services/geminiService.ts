
import { GoogleGenAI, Type } from "@google/genai";
import { PaperInsights, GroundingChunk, VectorChunk } from "../types";
import { createVectorStore, retrieveRelevantChunks } from "./vectorStore";
import { searchSemanticScholar, calculateMath, toolsDef } from "./agentTools";

const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

// 1. Indexing (Called on Upload)
export const indexPaper = async (fullText: string): Promise<VectorChunk[]> => {
  return await createVectorStore(fullText);
};

// 2. Insights (Unchanged - using Flash for speed)
export const analyzePaperStructure = async (paperText: string): Promise<PaperInsights> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Analyze this paper. Extract title, summary, outline, key points, and concepts.
    TEXT: ${paperText.slice(0, 50000)}`, // Limit context for insights speed
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          outline: { type: Type.ARRAY, items: { type: Type.STRING } },
          keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          concepts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                concept: { type: Type.STRING },
                description: { type: Type.STRING },
                relatedTo: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        }
      }
    }
  });

  const text = response.text || "{}";
  // Robust JSON parsing (same as before)
  let jsonString = text;
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match) jsonString = match[1];
  
  try {
    const parsed = JSON.parse(jsonString);
    return {
      title: parsed.title || "Untitled",
      summary: parsed.summary || "",
      outline: parsed.outline || [],
      keyPoints: parsed.keyPoints || [],
      concepts: parsed.concepts || []
    };
  } catch (e) {
    return { title: "Error", summary: "Analysis failed", outline: [], keyPoints: [], concepts: [] };
  }
};

// 3. AGENTIC CHAT LOOP
export const chatWithPaper = async (
  query: string,
  vectorStore: VectorChunk[], // RAG Memory
  history: any[],
  imageBase64?: string // Visual Input
): Promise<{ text: string, groundingChunks?: GroundingChunk[], steps: string[] }> => {
  
  const steps: string[] = [];

  // Step A: RAG Retrieval
  steps.push("Retrieving relevant pages...");
  const relevantChunks = await retrieveRelevantChunks(query, vectorStore, 4);
  const ragContext = relevantChunks.map(c => `[Page ${c.pageNumber}]: ${c.text}`).join('\n\n');
  
  // Step B: Construct System Prompt
  const systemInstruction = `You are ScholarLens, an Agentic Research Assistant.
  
  TOOLS AVAILABLE:
  1. Google Search: For current events/news.
  2. Semantic Scholar: For finding related papers/citations.
  3. Calculator: For exact math.
  
  CONTEXT FROM PAPER (RAG):
  ${ragContext}
  
  INSTRUCTIONS:
  1. Answer based on the RAG context first.
  2. If the user asks for outside info, use tools.
  3. If math is needed, use the calculator.
  4. Cite pages as [[Page N]].
  `;

  // Prepare content
  const contentParts: any[] = [{ text: query }];
  if (imageBase64) {
    contentParts.unshift({
      inlineData: { mimeType: 'image/jpeg', data: imageBase64 }
    });
    steps.push("Analyzing visual content...");
  }

  // Step C: Start Chat Session
  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview', // Agent Model
    config: { systemInstruction, tools: toolsDef },
    history
  });

  // Step D: Execution Loop (LangGraph style linear loop)
  let response = await chat.sendMessage({
    message: contentParts
  });

  // Handle Tool Calls (max 3 turns)
  let turns = 0;
  while (response.functionCalls && response.functionCalls.length > 0 && turns < 3) {
    turns++;
    const call = response.functionCalls[0];
    const { name, args } = call;
    
    let result = "";
    if (name === "search_semantic_scholar") {
      steps.push(`Searching Semantic Scholar for "${args.query}"...`);
      result = await searchSemanticScholar(args.query as string);
    } else if (name === "calculate_math") {
      steps.push(`Calculating ${args.expression}...`);
      result = calculateMath(args.expression as string);
    }

    // Feed result back to model
    response = await chat.sendMessage({
        message: [{
            functionResponse: {
                name: name,
                response: { result: result }
            }
        }]
    });
  }

  const text = response.text || "No response generated.";
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[];

  return { text, groundingChunks, steps };
};

// 4. Explanation (Simplified RAG)
export const explainTextSelection = async (selection: string, fullText: string, level: string) => {
    // Quick explanation doesn't need full RAG usually, context window is large enough for pages
    // We stick to the previous implementation for speed on simple tooltips
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Explain this text for a ${level} audience: "${selection}". Context: ...${fullText.slice(0, 10000)}... Reconstruct LaTeX math.`;
    const res = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt
    });
    return { text: res.text || "", groundingChunks: [] };
};
