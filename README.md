<div align="center">
  <img src="https://raw.githubusercontent.com/Bhavesh007Sharma/ScholarLens-AI/main/logo.png" width="100%" />
</div>


# ScholarLens AI – Agentic Research Assistant

ScholarLens AI is an advanced **Agentic Research Assistant** for serious readers, students, and researchers.  
Unlike standard “chat with your PDF” tools that just summarize text, ScholarLens runs an **autonomous agentic loop** that can:

- Read and reason over long research papers  
- Browse the web for **fresh citations and related work**  
- Verify **math, tables, and metrics** programmatically  
- “Look” at **diagrams, charts, and equations** that are not selectable as text  

Think of it as an AI co-pilot that actually *studies the paper with you* instead of only summarizing it.

---

## 🔍 Core Capabilities

### 1. Don’t Just Read – **Verify**
Papers can be outdated or rely on weak citations.

- Uses **Semantic Scholar / web tools** to:
  - Check citation counts and publication years  
  - Compare with more recent work  
- Helps you quickly judge whether a result or claim is still relevant.

### 2. **Math Without Hallucination**
LLMs are bad at raw arithmetic and table calculations.

- ScholarLens routes numerical reasoning to a **Code/Math tool**.
- Examples:
  - Compute averages, confidence intervals, or error reductions from a table  
  - Verify if numbers in the text match the values in the results section  
- Ensures **100% accurate** numerical analysis instead of “best guess” math.

### 3. **Visual Understanding**
Most tools only handle text. ScholarLens can also “see”.

- Uses **HTML5 Canvas + PDF.js** to render pages as images.
- Sends those images to the model’s **vision** interface.
- Can interpret:
  - Architecture diagrams  
  - Plots and graphs  
  - Flow charts  
  - Chemical structures and formula layouts  

### 4. **Adaptive Explanations (High School → PhD)**
You control the level of depth.

- Highlight any text: equation, paragraph, or definition.
- Ask:
  - “Explain this at a high school level” → simple analogies and step-by-step intuition  
  - “Explain this at a PhD level” → detailed, technical, assumption-heavy explanation  

### 5. **Interactive Navigation with Smart Citations**
Every answer ties back to the source.

- Responses include smart references like `[[Page 5]]`.
- Clicking them scrolls the PDF viewer to the **exact** paragraph, equation, or figure.
- This keeps the AI grounded and makes it easy to verify what it claims.

---

## 🧠 Technical Architecture

ScholarLens uses a **multi-model, agentic design** on top of the **Google GenAI SDK**.

### 1. The Core Intelligence (LLMs)

**The Orchestrator (Agent): `gemini-3-pro-preview`**  
- Handles the main conversation, reasoning, and tool selection.  
- Uses **function calling** to invoke tools (web search, math, citation lookup, etc.).  
- Large context window for full-paper reasoning.  
- Responsible for the visible “Thinking” steps in the UI.

**The Analyst (JSON Extractor): `gemini-2.5-flash`**  
- Powers the fast **Insights** panel.  
- Extracts:
  - Summary  
  - Key points  
  - Core concepts and sections  
- Optimized for **speed and strict JSON schemas**, so the UI doesn’t break.

**The Memory (Embeddings): `text-embedding-004`**  
- Converts text into dense vector representations.  
- Enables **semantic search** instead of keyword search:
  - “self-attention bottleneck” will still match the right paragraph even if the paper uses different wording.

---

### 2. Agentic Loop (Perception → Tools → Reflection)

The system doesn’t just answer once and stop. It runs a **loop**:

1. **Perception**  
   - Receives: user query + top RAG chunks + optional images of pages.
2. **Reasoning**  
   - The Agent decides:
     - “Can I answer now?”  
     - “Do I need tools (web, math, citations, code)?”  
3. **Tool Calls** (examples)  
   - Semantic Scholar / scholarly APIs for citations  
   - Custom math / code runner for table analysis  
   - Web search for latest benchmarks or competing models  
4. **Reflection**  
   - Agent looks at tool outputs.  
   - May call further tools or revise its thinking.  
5. **Response**  
   - Synthesizes a final answer with:
     - Explanations  
     - Comparisons  
     - `[[Page X]]` references back into the PDF  

This loop enables **multi-step reasoning** instead of a single-shot reply.

---

### 3. Client-Side RAG (Retrieval-Augmented Generation)

ScholarLens uses a **client-side vector store** so the browser can handle retrieval.

- Vector store implementation: `services/vectorStore.ts`
- Pipeline:
  1. Split the PDF into ~1000-character **chunks**.  
  2. Embed each chunk into a **768-dimensional vector** using `text-embedding-004`.  
  3. When you ask a question:
     - Compute cosine similarity between your query vector and all chunk vectors.  
     - Retrieve the top **k = 4** most relevant chunks.  
  4. Pass these chunks to the LLM as **focused context**.

Result: The AI “remembers” the entire document but does not get distracted by irrelevant sections.

---

### 4. Multimodal Vision Pipeline

- Uses **PDF.js** to render a specific page to an `HTML5 Canvas`.
- Converts the rendered canvas to **Base64-encoded image data**.
- Sends that to the LLM’s **vision endpoint**.
- The Agent then:
  - Reads labels, axes, and legends in graphs.  
  - Interprets architecture blocks in diagrams.  
  - Explains non-selectable tables, flows, and notations.

---

## 👣 Typical User Journey

1. **Upload a Paper**  
   - Example: “Attention Is All You Need” or any dense technical PDF.

2. **Instant Insights**  
   - The app extracts:
     - High-level summary  
     - Key contributions  
     - Core concepts / methods  
   - Shown as an interactive **Insights** dashboard.

3. **Concept Exploration**  
   - Click on a “Concept Card” (e.g., “Self-Attention”, “Transformers”).  
   - The Agent:
     - Uses RAG to explain how the paper defines it  
     - May call web search for real-world analogies or newer developments

4. **Inline Explanations**  
   - While reading, highlight any confusing paragraph or equation.  
   - Ask: “Explain this at high school level” or “Explain this at PhD level.”  
   - Get tailored explanations in context.

5. **Critical Comparison**  
   - Ask: “Does this paper outperform the latest Meta models?”  
   - The Agent:
     - Looks up recent Meta models via web tools  
     - Reads metrics from the uploaded paper  
     - Compares results and provides a **sourced** answer.

6. **Export Notes**  
   - Export the conversation and analysis as **Markdown**.  
   - Ideal for research notes, literature review sections, or thesis material.

---

## 🧩 Tech Stack Overview

**Frontend**
- TypeScript / React (Next.js or similar)
- PDF.js for PDF rendering
- HTML5 Canvas for page rasterization
- In-browser Vector Store (`services/vectorStore.ts`)

**Backend / Orchestration**
- Google GenAI SDK
- `gemini-3-pro-preview` for reasoning and tools
- `gemini-2.5-flash` for fast JSON extraction
- `text-embedding-004` for embeddings and semantic search
- Custom tools:
  - Web search
  - Semantic Scholar / paper lookup
  - Math/Code execution

---


## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
