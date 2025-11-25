import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ExternalLink, BookOpen } from 'lucide-react';
import { GroundingChunk } from '../types';

interface Props {
  content: string;
  groundingChunks?: GroundingChunk[];
  onCitationClick?: (page: number) => void;
}

export const MarkdownRenderer: React.FC<Props> = ({ content, groundingChunks, onCitationClick }) => {
  
  // Custom renderer to intercept text and create citation buttons
  const renderTextWithCitations = (text: string) => {
    const parts = text.split(/(\[\[Page \d+\]\])/g);
    return parts.map((part, i) => {
      const match = part.match(/\[\[Page (\d+)\]\]/);
      if (match) {
        const pageNum = parseInt(match[1]);
        return (
          <button 
            key={i}
            onClick={() => onCitationClick?.(pageNum)}
            className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 text-xs font-mono transition-colors cursor-pointer border border-blue-500/30 translate-y-[-1px]"
            title={`Jump to Page ${pageNum}`}
          >
            <BookOpen size={10} />
            p.{pageNum}
          </button>
        );
      }
      return part;
    });
  };

  return (
    <div className="text-sm w-full break-words prose prose-invert max-w-none prose-p:leading-snug prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 prose-pre:my-2 prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({node, ...props}) => <a {...props} className="text-blue-400 hover:underline" target="_blank" rel="noreferrer" />,
          code: ({node, className, children, ...props}) => {
             return <code className={`${className} bg-slate-800 px-1 py-0.5 rounded text-pink-300 font-mono text-[0.9em] break-all`} {...props}>{children}</code>
          },
          p: ({children}) => <p className="mb-2 last:mb-0">{React.Children.map(children, child => {
            if (typeof child === 'string') return renderTextWithCitations(child);
            return child;
          })}</p>,
          li: ({children}) => <li className="">{React.Children.map(children, child => {
            if (typeof child === 'string') return renderTextWithCitations(child);
            return child;
          })}</li>
        }}
      >
        {content}
      </ReactMarkdown>

      {/* Grounding Sources */}
      {groundingChunks && groundingChunks.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-700/50 flex flex-wrap gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 self-center mr-2">Sources:</span>
            {groundingChunks.map((chunk, idx) => (
              chunk.web && (
                <a key={idx} href={chunk.web.uri} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-950/30 hover:bg-emerald-950/50 px-2 py-1 rounded-md border border-emerald-900/50 transition-all">
                  <ExternalLink size={10} />
                  {chunk.web.title}
                </a>
              )
            ))}
        </div>
      )}
    </div>
  );
};