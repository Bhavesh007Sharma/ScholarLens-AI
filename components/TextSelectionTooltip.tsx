import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, Microscope } from './Icons';

interface Props {
  onExplain: (level: 'High School' | 'PhD') => void;
  visible: boolean;
  position: { x: number; y: number };
}

export const TextSelectionTooltip: React.FC<Props> = ({ onExplain, visible, position }) => {
  if (!visible) return null;

  return createPortal(
    <div 
      style={{ top: position.y - 50, left: position.x }}
      className="fixed z-50 flex flex-col gap-1 p-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl animate-fade-in transform -translate-x-1/2"
    >
      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold px-2 py-1 text-center">Explain as</div>
      <div className="flex gap-1">
        <button 
          onClick={() => onExplain('High School')}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-blue-600 rounded transition-colors whitespace-nowrap"
        >
          <GraduationCap size={14} />
          High School
        </button>
        <button 
          onClick={() => onExplain('PhD')}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-purple-600 rounded transition-colors whitespace-nowrap"
        >
          <Microscope size={14} />
          PhD Level
        </button>
      </div>
    </div>,
    document.body
  );
};