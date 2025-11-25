
import { Type } from "@google/genai";

// Agent Tools for "ScholarLens"

// Tool 1: Semantic Scholar API (The "Librarian")
export const searchSemanticScholar = async (query: string) => {
  try {
    // Public API - rate limited but works for demo
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=3&fields=title,abstract,year,citationCount,url`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data.data || data.data.length === 0) return "No papers found.";
    
    return data.data.map((p: any) => 
      `Title: ${p.title} (${p.year})\nCitations: ${p.citationCount}\nAbstract: ${p.abstract?.slice(0, 150)}...\nLink: ${p.url}`
    ).join('\n\n');
  } catch (e) {
    return "Error connecting to Semantic Scholar API.";
  }
};

// Tool 2: Math Interpreter (The "Calculator")
export const calculateMath = (expression: string) => {
  try {
    // Sanitized evaluation
    // We only allow basic math characters
    if (/[^0-9+\-*/().\s]/.test(expression)) {
      return "Error: Only basic math allowed.";
    }
    // eslint-disable-next-line no-new-func
    const result = new Function(`return ${expression}`)();
    return `Calculated Result: ${result}`;
  } catch (e) {
    return "Math Error.";
  }
};

// Tool Definitions for Gemini
export const toolsDef = [
  {
    functionDeclarations: [
      {
        name: "search_semantic_scholar",
        description: "Search for related research papers, citations, or previous work.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "Keywords to search for" }
          },
          required: ["query"]
        }
      },
      {
        name: "calculate_math",
        description: "Perform exact mathematical calculations (e.g. averages from tables).",
        parameters: {
          type: Type.OBJECT,
          properties: {
            expression: { type: Type.STRING, description: "The math expression to evaluate (e.g. (23+45)/2)" }
          },
          required: ["expression"]
        }
      }
    ]
  },
  { googleSearch: {} } // Native Google Search
];
