import { useState } from 'react';
import { Clock, Cloud, AlignLeft, Square, Image, Sliders, Save, Grid } from 'lucide-react';

const templates = [
  { id: '1', label: 'Full Screen', layout: [[100, 100]], icon: '▪' },
  { id: '2', label: '50/50 Split', layout: [[50, 100], [50, 100]], icon: '⧩' },
  { id: '3', label: '70/30 Split', layout: [[70, 100], [30, 100]], icon: '⧨' },
  { id: '4', label: 'Top Bar', layout: [[100, 20], [100, 80]], icon: '⊟' },
  { id: '5', label: 'Bottom Bar', layout: [[100, 80], [100, 20]], icon: '⊠' },
];

const widgets = [
  { id: 'clock', label: 'Clock', icon: <Clock size={16} /> },
  { id: 'weather', label: 'Weather', icon: <Cloud size={16} /> },
  { id: 'ticker', label: 'Ticker', icon: <AlignLeft size={16} /> },
  { id: 'logo', label: 'Logo', icon: <Image size={16} /> },
];

export default function LayoutStudio() {
  const [selected, setSelected] = useState('1');
  const [bgColor, setBgColor] = useState('#000000');
  const [addedWidgets, setAddedWidgets] = useState<string[]>([]);

  const template = templates.find(t => t.id === selected)!;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Layout Studio</h1>
          <p className="text-sm text-gray-500 mt-0.5">Design split-screen layouts for your displays</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Save size={16} /> Save Layout
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Templates */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Templates</h2>
          <div className="space-y-2">
            {templates.map(t => (
              <button key={t.id} onClick={() => setSelected(t.id)} className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                selected === t.id ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-100 hover:border-gray-200 text-gray-700'
              }`}>
                <span className="text-lg w-6 text-center">{t.icon}</span>
                <span className="text-sm font-medium">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Widgets</h3>
            <div className="grid grid-cols-2 gap-2">
              {widgets.map(w => (
                <button key={w.id} onClick={() => setAddedWidgets(p => p.includes(w.id) ? p.filter(x => x !== w.id) : [...p, w.id])}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                    addedWidgets.includes(w.id) ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}>
                  {w.icon} {w.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Background Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-10 h-8 rounded cursor-pointer border border-gray-200" />
              <span className="text-xs text-gray-500 font-mono">{bgColor}</span>
            </div>
          </div>
        </div>

        {/* Preview Canvas */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Preview — {template.label}</h2>
          <div className="rounded-lg overflow-hidden border-4 border-gray-900 aspect-video relative" style={{ background: bgColor }}>
            <div className="absolute inset-0 flex">
              {selected === '1' && (
                <div className="flex-1 border-2 border-dashed border-white/30 flex items-center justify-center">
                  <div className="text-center text-white/60">
                    <Grid size={32} className="mx-auto mb-2" />
                    <p className="text-xs">Full Screen Zone</p>
                    <p className="text-xs">1920 × 1080</p>
                  </div>
                </div>
              )}
              {selected === '2' && (
                <>
                  <div className="flex-1 border-2 border-dashed border-white/30 flex items-center justify-center">
                    <div className="text-center text-white/60 text-xs"><p>Zone 1</p><p>50%</p></div>
                  </div>
                  <div className="flex-1 border-2 border-dashed border-white/30 flex items-center justify-center">
                    <div className="text-center text-white/60 text-xs"><p>Zone 2</p><p>50%</p></div>
                  </div>
                </>
              )}
              {selected === '3' && (
                <>
                  <div className="border-2 border-dashed border-white/30 flex items-center justify-center" style={{ width: '70%' }}>
                    <div className="text-center text-white/60 text-xs"><p>Main Zone</p><p>70%</p></div>
                  </div>
                  <div className="border-2 border-dashed border-white/30 flex items-center justify-center" style={{ width: '30%' }}>
                    <div className="text-center text-white/60 text-xs"><p>Side</p><p>30%</p></div>
                  </div>
                </>
              )}
              {selected === '4' && (
                <div className="flex-1 flex flex-col">
                  <div className="border-2 border-dashed border-white/30 flex items-center justify-center" style={{ height: '20%' }}>
                    <span className="text-white/60 text-xs">Top Bar 20%</span>
                  </div>
                  <div className="border-2 border-dashed border-white/30 flex-1 flex items-center justify-center">
                    <span className="text-white/60 text-xs">Main Content 80%</span>
                  </div>
                </div>
              )}
              {selected === '5' && (
                <div className="flex-1 flex flex-col">
                  <div className="border-2 border-dashed border-white/30 flex-1 flex items-center justify-center">
                    <span className="text-white/60 text-xs">Main Content 80%</span>
                  </div>
                  <div className="border-2 border-dashed border-white/30 flex items-center justify-center" style={{ height: '20%' }}>
                    <span className="text-white/60 text-xs">Bottom Bar 20%</span>
                  </div>
                </div>
              )}
            </div>
            {addedWidgets.includes('ticker') && (
              <div className="absolute bottom-0 left-0 right-0 bg-blue-900/80 text-white text-xs px-3 py-1.5">
                ▶ Breaking news ticker scrolling here...
              </div>
            )}
            {addedWidgets.includes('clock') && (
              <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded font-mono">
                02:32:10 PM
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Drag zones to resize (interactive mode)</p>
        </div>
      </div>
    </div>
  );
}
