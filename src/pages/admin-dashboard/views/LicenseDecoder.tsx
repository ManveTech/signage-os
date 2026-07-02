import React, { useState } from 'react';
import { Shield, Copy, Check, Info } from 'lucide-react';

const CHAR_MAP: Record<string, number> = {
  A: 37, B: 14, C: 82, D: 53, E: 9,
  F: 64, G: 21, H: 75, I: 48, J: 93,
  K: 30, L: 88, M: 5,  N: 72, O: 19,
  P: 41, Q: 97, R: 26, S: 58, T: 83,
  U: 11, V: 69, W: 46, X: 99, Y: 15,
  Z: 78
};

export default function LicenseDecoder() {
  const [inputText, setInputText] = useState('');
  const [copied, setCopied] = useState(false);

  const getDecodingDetails = (text: string) => {
    const chars = text.toUpperCase().split('');
    const breakdown = chars.map(char => {
      const code = CHAR_MAP[char];
      return {
        char,
        code: code !== undefined ? code.toString() : char
      };
    });
    const concatenated = breakdown.map(item => item.code).join('');
    return { breakdown, concatenated };
  };

  const { breakdown, concatenated } = getDecodingDetails(inputText);

  const handleCopy = () => {
    if (!concatenated) return;
    navigator.clipboard.writeText(concatenated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="text-blue-600" size={24} /> License Code Decoder
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Translate custom alphanumeric text into numerical keys using the key matrix.
        </p>
      </div>

      {/* Main Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Input & Result Column */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">
                Enter Text to Decode
              </label>
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="e.g. TEST"
                className="w-full px-4 py-3 text-sm font-semibold border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-slate-50 text-slate-800 tracking-wide uppercase"
              />
            </div>

            {/* Decoded Result */}
            {inputText && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Decoded Numeric Value
                  </span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-550/10 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy Code'}
                  </button>
                </div>
                <div className="p-4 bg-slate-900 text-white rounded-xl font-mono text-xl font-bold tracking-widest break-all">
                  {concatenated || '—'}
                </div>
              </div>
            )}
          </div>

          {/* Breakdown Table */}
          {inputText && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-3">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                Character Breakdown
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {breakdown.map((item, i) => (
                  <div key={i} className="flex flex-col items-center justify-center p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-center">
                    <span className="text-xs text-slate-400 font-bold">{item.char}</span>
                    <span className="text-sm font-bold text-slate-850 mt-1 font-mono">{item.code}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Reference Matrix Column */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Info size={14} className="text-slate-400" /> Decode Matrix
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono font-bold text-slate-700">
              {Object.entries(CHAR_MAP).map(([char, val]) => (
                <div key={char} className="flex justify-between p-2 bg-slate-50 rounded-lg border border-slate-100/50">
                  <span className="text-slate-400">{char}</span>
                  <span className="text-blue-600 font-bold">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
