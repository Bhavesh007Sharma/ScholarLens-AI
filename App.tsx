import React, { useState, useRef, useEffect } from 'react';
import { LoadingState, PaperData, PaperInsights, ChatMessage, MessageRole } from './types';
import { extractTextFromPdf, getDocument, renderPageAsImage } from './utils/pdfUtils';
import { analyzePaperStructure, chatWithPaper, explainTextSelection, indexPaper } from './services/geminiService';
import { Upload, MessageSquare, Sparkles, Send, X, ChevronRight, Search, FileText, Download, Eye, Cpu } from './components/Icons';
import { Button } from './components/Button';
import { TextSelectionTooltip } from './components/TextSelectionTooltip';
import { PdfViewer } from './components/PdfViewer';
import { MarkdownRenderer } from './components/MarkdownRenderer';

const STORAGE_KEY = 'scholar_lens_session_v2';

function App() {
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [paperData, setPaperData] = useState<PaperData | null>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const [insights, setInsights] = useState<PaperInsights | null>(null);
  const [activeTab, setActiveTab] = useState<'insights' | 'chat'>('insights');
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [agentSteps, setAgentSteps] = useState<string[]>([]); // To show agent thinking
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [selectionTooltip, setSelectionTooltip] = useState<{visible: boolean, x: number, y: number, text: string}>({
    visible: false, x: 0, y: 0, text: ''
  });

  useEffect(() => {
    const savedSession = localStorage.getItem(STORAGE_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.paperData) setPaperData(parsed.paperData);
        if (parsed.insights) setInsights(parsed.insights);
        if (parsed.messages) setMessages(parsed.messages);
      } catch (e) {
        console.error("Failed to restore session", e);
      }
    }
  }, []);

  useEffect(() => {
    if (paperData && insights) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ paperData, insights, messages }));
    }
  }, [paperData, insights, messages]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoadingState(LoadingState.PARSING);
    try {
      const pdfDoc = await getDocument(file);
      setPdfDocument(pdfDoc);

      const { text, pageCount } = await extractTextFromPdf(pdfDoc);
      
      // Step 2: Indexing (RAG)
      setLoadingState(LoadingState.INDEXING);
      const vectorStore = await indexPaper(text);
      
      const newPaperData = { fileName: file.name, fullText: text, pageCount, vectorStore };
      setPaperData(newPaperData);
      
      // Step 3: Analysis
      setLoadingState(LoadingState.ANALYZING);
      const data = await analyzePaperStructure(text);
      setInsights(data);
      setLoadingState(LoadingState.READY);
      
      setMessages([{
        id: 'init',
        role: MessageRole.MODEL,
        text: `I've indexed **${data.title}** (${vectorStore.length} chunks). \n\nI can read charts, search for citations (Semantic Scholar), and do math.`
      }]);
      setCurrentPdfPage(1);

    } catch (error) {
      console.error(error);
      setLoadingState(LoadingState.ERROR);
    }
  };

  const sendMessage = async (text: string, imageBase64?: string) => {
    if (!paperData || !paperData.vectorStore) return;
    
    const userMsg: ChatMessage = { 
      id: Date.now().toString(), 
      role: MessageRole.USER, 
      text,
      image: imageBase64 
    };
    setMessages(prev => [...prev, userMsg]);
    setIsChatLoading(true);
    setAgentSteps([]); // Reset steps

    try {
      // Prepare history
      const history = messages.filter(m => m.id !== 'init').map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      // Call Agent
      const { text: responseText, groundingChunks, steps } = await chatWithPaper(
        text, 
        paperData.vectorStore, 
        history, 
        imageBase64
      );
      
      // Show steps briefly or just log them
      setAgentSteps(steps);

      const aiMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: MessageRole.MODEL, 
        text: responseText,
        groundingChunks,
        steps // Save steps to message to display logic
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: MessageRole.MODEL, text: "Agent Error: " + (error as any).message }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    sendMessage(inputMessage);
    setInputMessage('');
  };

  const handleVisualAnalysis = async () => {
    if (!pdfDocument) return;
    setIsChatLoading(true);
    try {
        const imageBase64 = await renderPageAsImage(pdfDocument, currentPdfPage);
        sendMessage(`Analyze this visual page (Page ${currentPdfPage}). Explain diagrams or charts found.`, imageBase64);
    } catch (e) {
        console.error(e);
        setIsChatLoading(false);
    }
  };

  const handleExplainSelection = async (level: 'High School' | 'PhD') => {
    if (!paperData || !selectionTooltip.text) return;
    setActiveTab('chat');
    setSelectionTooltip(prev => ({ ...prev, visible: false }));
    sendMessage(`Explain this text (${level} level): "${selectionTooltip.text}"`);
  };

  // ... (Keep handleDownloadChat same as before)
  const handleDownloadChat = () => {
     if (!insights || !messages) return;
     const content = `# ${insights.title} - Analysis\n\n## Summary\n${insights.summary}\n\n## Chat History\n\n` + 
        messages.map(m => `### ${m.role.toUpperCase()}\n${m.text}`).join('\n\n');
     
     const blob = new Blob([content], { type: 'text/markdown' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `${insights.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_analysis.md`;
     a.click();
  };
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab, agentSteps]);

  if (!paperData) {
    // Render Upload Screen (Preserved)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
         <div className="max-w-xl w-full text-center space-y-8">
            <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">ScholarLens Agent</h1>
            <div className="border-2 border-dashed border-slate-700 rounded-2xl p-12 bg-slate-900/50 relative">
               <input type="file" accept=".pdf" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
               <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
               <p className="text-slate-300">Upload PDF</p>
            </div>
            {loadingState !== LoadingState.IDLE && (
                <div className="text-blue-400 animate-pulse font-medium">
                    {loadingState === LoadingState.PARSING && "Reading PDF..."}
                    {loadingState === LoadingState.INDEXING && "Indexing Vector Store..."}
                    {loadingState === LoadingState.ANALYZING && "Generating initial analysis..."}
                </div>
            )}
         </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-2 font-bold text-slate-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            ScholarLens Agent
        </div>
        <div className="flex gap-2">
            {!pdfDocument && <Button size="sm" variant="secondary" onClick={() => document.getElementById('reupload')?.click()}>Reload PDF</Button>}
            <input id="reupload" type="file" className="hidden" onChange={handleFileUpload} />
            <Button size="sm" variant="ghost" onClick={handleDownloadChat}><Download size={16} className="mr-2"/>Export</Button>
            <Button size="sm" variant="ghost" onClick={() => { setPaperData(null); localStorage.removeItem(STORAGE_KEY); }}>Close</Button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex overflow-hidden">
        {/* PDF Viewer */}
        <div className="flex-1 border-r border-slate-800 relative bg-slate-900/30">
          <PdfViewer 
            pdfDocument={pdfDocument} 
            pageNumber={currentPdfPage}
            onPageChange={setCurrentPdfPage}
            onTextSelect={(e) => {
               const sel = window.getSelection()?.toString().trim();
               if(sel) setSelectionTooltip({ visible: true, x: e.clientX, y: e.clientY, text: sel });
            }}
          />
          <TextSelectionTooltip visible={selectionTooltip.visible} position={selectionTooltip} onExplain={handleExplainSelection} />
        </div>

        {/* AI Panel */}
        <div className="w-[500px] flex flex-col bg-slate-950 border-l border-slate-800">
           <div className="flex border-b border-slate-800 shrink-0">
              <button onClick={() => setActiveTab('insights')} className={`flex-1 py-3 text-xs font-bold ${activeTab === 'insights' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500'}`}>INSIGHTS</button>
              <button onClick={() => setActiveTab('chat')} className={`flex-1 py-3 text-xs font-bold ${activeTab === 'chat' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500'}`}>AGENT CHAT</button>
           </div>

           <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 custom-scrollbar">
              {activeTab === 'insights' && (
                <>
                  {loadingState === LoadingState.ANALYZING && !insights ? (
                    <div className="flex flex-col items-center justify-center h-64 space-y-4 text-center animate-pulse">
                      <Cpu className="w-12 h-12 text-blue-500" />
                      <div className="text-slate-300 font-medium">Generating Paper Insights...</div>
                      <div className="text-xs text-slate-500 max-w-[200px]">Extracting summary, key points, and concepts.</div>
                    </div>
                  ) : insights ? (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold text-white">{insights.title}</h2>
                        <p className="text-slate-300 text-sm">{insights.summary}</p>
                        <div className="space-y-2">
                            {insights.keyPoints.map((k, i) => <div key={i} className="text-sm text-slate-400">• {k}</div>)}
                        </div>
                    </div>
                  ) : null}
                </>
              )}

              {activeTab === 'chat' && (
                  <div className="space-y-4">
                      {messages.map(msg => (
                          <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}>
                              <div className={`w-fit max-w-[90%] rounded-xl p-4 break-words ${msg.role === MessageRole.USER ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800'}`}>
                                  {msg.image && <img src={`data:image/jpeg;base64,${msg.image}`} className="w-48 h-auto object-cover rounded mb-2 border border-white/20 bg-white" alt="Analyzed Page" />}
                                  
                                  {/* Agent Steps Display */}
                                  {msg.steps && msg.steps.length > 0 && (
                                      <div className="mb-3 text-[10px] text-slate-500 font-mono space-y-1 bg-black/20 p-2 rounded border border-white/5">
                                          {msg.steps.map((step, i) => (
                                              <div key={i} className="flex items-center gap-1.5">
                                                  <Cpu size={10} /> {step}
                                              </div>
                                          ))}
                                      </div>
                                  )}

                                  <MarkdownRenderer content={msg.text} groundingChunks={msg.groundingChunks} onCitationClick={setCurrentPdfPage} />
                              </div>
                          </div>
                      ))}
                      {isChatLoading && (
                          <div className="flex flex-col gap-2 p-4 bg-slate-900/50 rounded-xl animate-pulse border border-slate-800/50">
                              <div className="text-xs text-blue-400 font-mono flex items-center gap-2">
                                  <Sparkles size={12} /> Agent Working...
                              </div>
                              {agentSteps.map((step, i) => (
                                  <div key={i} className="text-xs text-slate-500 ml-4">• {step}</div>
                              ))}
                          </div>
                      )}
                      <div ref={chatEndRef} />
                  </div>
              )}
           </div>

           {activeTab === 'chat' && (
               <div className="p-4 border-t border-slate-800 bg-slate-900 relative shrink-0">
                   <div className="flex gap-2">
                       <button 
                           onClick={handleVisualAnalysis}
                           title="Look at current PDF page"
                           disabled={isChatLoading || !pdfDocument}
                           className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                       >
                           <Eye size={20} />
                       </button>
                       <div className="flex-1 relative">
                           <input 
                               value={inputMessage}
                               onChange={(e) => setInputMessage(e.target.value)}
                               onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                               placeholder="Ask Agent (e.g., 'Check Semantic Scholar for...')"
                               className="w-full bg-slate-950 border border-slate-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
                               disabled={isChatLoading}
                           />
                           <button 
                               onClick={handleSendMessage}
                               disabled={isChatLoading || !inputMessage.trim()}
                               className="absolute right-2 top-2 p-1.5 text-blue-500 hover:text-white"
                           >
                               <Send size={18} />
                           </button>
                       </div>
                   </div>
               </div>
           )}
        </div>
      </main>
    </div>
  );
}

export default App;