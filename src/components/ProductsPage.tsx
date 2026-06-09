import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ArrowUpRight, 
  Check, 
  X, 
  Monitor, 
  Tv, 
  LayoutGrid, 
  Mic, 
  Ruler, 
  Layers, 
  Cpu, 
  Settings, 
  Phone, 
  ShieldCheck,
  Zap, 
  Briefcase 
} from 'lucide-react';
import { products, categories, Product } from '../data/productsData';

interface ProductsPageProps {
  onOpenQuote: (productName?: string) => void;
  onBackToHome: () => void;
}

export default function ProductsPage({ onOpenQuote, onBackToHome }: ProductsPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  // Filter products based on selected tab
  const filteredProducts = useMemo(() => {
    if (selectedCategory === "all") return products;
    return products.filter(p => p.categoryId === selectedCategory);
  }, [selectedCategory]);

  // Dynamically compute 3 visual aspects of the selected product image
  const productImages = useMemo(() => {
    if (!selectedProduct) return [];
    const baseImg = selectedProduct.imageUrl;

    const img2 = baseImg.includes('/seed/') 
      ? baseImg.replace('/seed/', '/seed/angle-b-') 
      : `${baseImg}?sig=1`;

    const img3 = baseImg.includes('/seed/') 
      ? baseImg.replace('/seed/', '/seed/angle-c-') 
      : `${baseImg}?sig=2`;

    return [baseImg, img2, img3];
  }, [selectedProduct]);

  // Helper to map category icon
  const getCategoryIcon = (categoryId: string) => {
    switch (categoryId) {
      case "kiosks": return <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />;
      case "displays": return <Tv className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />;
      case "smart-tables": return <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />;
      case "podiums": return <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />;
      default: return <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />;
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-slate-50 text-slate-900 pt-24 pb-20 select-none" id="products-catalog-page">
      
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" id="products-bg-patterns">
        <svg className="absolute inset-0 w-full h-full opacity-[0.4]" width="100%" height="100%">
          <pattern id="products-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(15, 23, 42, 0.04)" strokeWidth="1" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#products-grid)" />
        </svg>
        <div className="absolute top-1/10 left-1/10 w-[500px] h-[500px] bg-sky-100/30 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/10 right-1/10 w-[400px] h-[400px] bg-orange-100/20 rounded-full blur-[130px]" />
      </div>

      <div className="container mx-auto px-4 sm:px-8 md:px-12 lg:px-24 relative z-10">
        
        {/* Navigation Breadcrumb inside page */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200" id="products-breadcrumb">
          <button 
            onClick={onBackToHome}
            className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-500 hover:text-accent duration-200 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home Landing
          </button>
        </div>

        <AnimatePresence mode="wait">
          {!selectedProduct ? (
            /* ==============================================================
               PRODUCT LIST VIEW
               ============================================================== */
            <motion.div
              key="list-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              
              {/* Mini Hero Section */}
              <div className="text-center sm:text-left mb-12 max-w-3xl" id="products-mini-hero">
                <span className="text-accent font-black tracking-[0.2em] uppercase text-[10px] sm:text-xs mb-3 block">
                  // PRODUCT CATALOG
                </span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight leading-tight">
                  State-of-The-Art <span className="text-accent italic font-light">Hardware Enclosures</span>
                </h1>
                <p className="text-slate-600 text-xs sm:text-sm md:text-base leading-relaxed">
                  Explore our premium, customized range of commercial-grade touch podiums, interactive kiosks, digital advertising hubs, and secure industrial sheet-metal enclosures built to order at our Bengaluru factory.
                </p>
              </div>

              {/* Category Filter Cards */}
              <div className="mb-10 text-left" id="products-category-pills">
                <p className="text-xs font-black tracking-[0.2em] uppercase text-slate-400 mb-4 block">
                  // CHOOSE CATEGORY SYSTEM
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {/* All products button card */}
                  <button
                    onClick={() => setSelectedCategory("all")}
                    className={`p-3.5 sm:p-4 rounded-xl text-left transition-all duration-300 cursor-pointer border flex flex-col justify-between h-[100px] sm:h-[115px] group ${
                      selectedCategory === "all"
                        ? "bg-white border-accent shadow-sm ring-1 ring-accent"
                        : "bg-white/70 border-slate-200/80 hover:bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className={`p-1.5 sm:p-2 rounded-lg ${
                        selectedCategory === "all" ? "bg-accent/15" : "bg-slate-100"
                      }`}>
                        <LayoutGrid className={`w-4 h-4 ${selectedCategory === "all" ? "text-accent" : "text-slate-500"}`} />
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 leading-none">
                        {products.length} units
                      </span>
                    </div>
                    <div>
                      <h4 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-wider group-hover:text-accent transition-colors">
                        All Products
                      </h4>
                      <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate mt-0.5">
                        Complete custom range
                      </p>
                    </div>
                  </button>

                  {/* Individual category cards */}
                  {categories.map((cat) => {
                    const count = products.filter(p => p.categoryId === cat.id).length;
                    const isActive = selectedCategory === cat.id;
                    const shortDescMap: Record<string, string> = {
                      "kiosks": "Interactive terminals",
                      "displays": "Digital standees",
                      "smart-tables": "Spill-proof tables",
                      "podiums": "Presentation lecterns"
                    };

                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`p-3.5 sm:p-4 rounded-xl text-left transition-all duration-300 cursor-pointer border flex flex-col justify-between h-[100px] sm:h-[115px] group ${
                          isActive
                            ? "bg-white border-accent shadow-sm ring-1 ring-accent"
                            : "bg-white/70 border-slate-200/80 hover:bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className={`p-1.5 sm:p-2 rounded-lg ${
                            isActive ? "bg-accent/15" : "bg-slate-100"
                          }`}>
                            {getCategoryIcon(cat.id)}
                          </div>
                          <span className="text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 leading-none">
                            {count} {count === 1 ? 'unit' : 'units'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-wider group-hover:text-accent transition-colors truncate w-full" title={cat.name}>
                            {cat.name.replace("Interactive & ", "").replace("Digital ", "").replace("Collaborative ", "").replace("Smart ", "")}
                          </h4>
                          <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate mt-0.5 w-full">
                            {shortDescMap[cat.id] || cat.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sub-header showing active filtered item info */}
              <div className="mb-8" id="active-category-banner">
                {selectedCategory !== "all" ? (
                  <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 max-w-4xl text-left shadow-xs">
                    <p className="text-accent font-extrabold text-xs uppercase tracking-widest mb-1.5 flex items-center gap-2">
                      {getCategoryIcon(selectedCategory)}
                      Category Showcase
                    </p>
                    <p className="text-slate-600 text-xs sm:text-sm font-semibold leading-relaxed">
                      {categories.find(c => c.id === selectedCategory)?.description}
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500 text-xs font-semibold tracking-wider uppercase text-left">
                    Showing all products ({products.length} systems)
                  </p>
                )}
              </div>

              {/* Grid Layout of products, loaded one by one */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8" id="products-catalog-grid">
                {filteredProducts.map((p, index) => {
                  return (
                    <div 
                      key={p.id}
                      className="bg-white border border-slate-200 hover:border-accent/40 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
                      id={`product-card-${p.id}`}
                    >
                      <div>
                        {/* Interactive Image box with increased visual height (aspect-[4/3] instead of aspect-video) */}
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 border-b border-slate-100">
                          <img 
                            src={p.imageUrl} 
                            alt={p.name} 
                            className="w-full h-full object-cover group-hover:scale-105 duration-500"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* Content */}
                        <div className="p-5 sm:p-6 text-left">
                          <h3 className="text-lg font-bold text-slate-950 mb-1 tracking-tight">
                            {p.name}
                          </h3>
                          <span className="text-xs text-accent italic font-bold tracking-wide block mb-3 leading-snug">
                            {p.headline}
                          </span>
                          <p className="text-slate-500 text-xs sm:text-sm mb-4 leading-relaxed line-clamp-2">
                            {p.description}
                          </p>
                          
                          {/* Key specifications snippet */}
                          <div className="space-y-1.5 border-t border-slate-100 pt-3.5 mb-2">
                            <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-500">
                              <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5 animate-pulse" /> Enclosure</span>
                              <span className="font-semibold text-slate-800 truncate max-w-[150px]">{p.specs.material}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-500">
                              <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5" /> Dimensions</span>
                              <span className="font-semibold text-slate-800 truncate max-w-[150px]">{p.dimensions}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Button Actions */}
                      <div className="px-5 sm:px-6 pb-6 pt-1 flex items-center gap-2.5">
                        <button
                          onClick={() => {
                            setSelectedProduct(p);
                            setActiveImageIndex(0);
                          }}
                          className="flex-1 text-center py-2 sm:py-2.5 bg-slate-50 border border-slate-200 hover:border-accent text-xs font-bold uppercase rounded-lg hover:bg-slate-100 hover:text-accent transition-colors duration-200 cursor-pointer text-slate-700 font-extrabold"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => onOpenQuote(p.name)}
                          className="px-3 sm:px-3.5 py-2 sm:py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-black uppercase flex items-center justify-center gap-1 cursor-pointer"
                          title="Get Quotation"
                        >
                          Quote <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

            </motion.div>
          ) : (
            /* ==============================================================
               PRODUCT DETAILED STATE VIEW (DYNAMIC ACCESSIBILITY)
               ============================================================== */
            <motion.div
              key="detail-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-8 md:p-10 text-left shadow-sm"
              id="product-details-container"
            >
              {/* Detail Page Breadcrumbs */}
              <button
                onClick={() => setSelectedProduct(null)}
                className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-accent hover:text-slate-800 mb-8 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Products Catalog
              </button>

              <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                
                {/* Left Side: Dynamic Showcase Image with 3 aspects toggle list */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm relative">
                    <img 
                      src={productImages[activeImageIndex] || selectedProduct.imageUrl} 
                      alt={`${selectedProduct.name} aspect view`} 
                      className="w-full h-full object-cover transition-all duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/75 rounded-md text-[10px] font-mono tracking-wider font-extrabold text-white">
                      {activeImageIndex === 0 ? "FRONT PERSPECTIVE" : activeImageIndex === 1 ? "PROFILE ANGLE" : "CHASSIS SPEC"}
                    </div>
                  </div>

                  {/* Thumbnail Selector (1st to 3rd angle option indicators) */}
                  <div className="grid grid-cols-3 gap-2" id="gallery-carousel-picker">
                    {productImages.map((imgSrc, idx) => {
                      const labels = ["Front Aspect", "Profile Angle", "Chassis Spec"];
                      const isSelected = activeImageIndex === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => setActiveImageIndex(idx)}
                          className={`relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-50 border transition-all duration-300 cursor-pointer ${
                            isSelected 
                              ? "border-accent ring-2 ring-accent/30 scale-102 shadow-xs" 
                              : "border-slate-200 hover:border-slate-400 hover:scale-[1.01]"
                          }`}
                        >
                          <img 
                            src={imgSrc} 
                            alt={`${selectedProduct.name} aspect thumbnail ${idx + 1}`} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className={`absolute inset-0 bg-black/45 flex items-end p-1.5 transition-opacity duration-200 ${
                            isSelected ? "opacity-0" : "opacity-0 hover:opacity-100"
                          }`}>
                            <span className="text-[8px] text-white font-extrabold uppercase tracking-wide truncate w-full">
                              {labels[idx]}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 bg-accent text-white p-0.5 rounded-full shadow-xs">
                              <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Fabric specifications alert card */}
                  <div className="p-4 rounded-xl bg-orange-50/50 border border-orange-100 text-left">
                    <h4 className="text-xs sm:text-sm font-extrabold text-orange-950 mb-1.5 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-accent" /> SignageOS Engineering Guarantee
                    </h4>
                    <p className="text-orange-900/80 text-[11px] leading-relaxed font-medium">
                      All structural steel, kiosks & cabinets undergo precise computer-guided CNC laser cutting, dual bends, high-accuracy assembly, and commercial heat-dissipation checks before shipment.
                    </p>
                  </div>
                </div>

                {/* Right Side: Product Details Header, Specs & Features */}
                <div className="lg:col-span-7 flex flex-col items-start">
                  
                  {/* Title Area */}
                  <span className="text-accent text-[10px] sm:text-xs font-black tracking-widest uppercase mb-2">
                    // MODEL SPECIFICATION
                  </span>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-2 leading-tight">
                    {selectedProduct.name}
                  </h2>
                  <span className="text-accent italic font-black tracking-wide text-xs sm:text-sm block mb-6 leading-relaxed">
                    {selectedProduct.headline}
                  </span>

                  {/* General Description */}
                  <p className="text-slate-650 text-xs sm:text-sm leading-relaxed mb-6">
                    {selectedProduct.description}
                  </p>

                  {/* Core Features bullets */}
                  <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-slate-800 mb-3 block">
                    Product Features
                  </h3>
                  <ul className="space-y-2 mb-8 w-full">
                    {selectedProduct.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2.5 font-medium text-slate-700 text-xs sm:text-sm leading-normal">
                        <div className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5 text-accent font-black" />
                        </div>
                        {feat}
                      </li>
                    ))}
                  </ul>

                  {/* Complete technical specification sheet */}
                  <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-slate-800 mb-3 block">
                    Technical Specifications
                  </h3>
                  <div className="w-full bg-slate-50/80 rounded-2xl border border-slate-200 divide-y divide-slate-200 overflow-hidden mb-8">
                    <div className="grid grid-cols-12 p-3 sm:p-4 text-xs">
                      <span className="col-span-4 font-bold text-slate-500">Display Monitor</span>
                      <span className="col-span-8 font-semibold text-slate-800">{selectedProduct.specs.display}</span>
                    </div>
                    <div className="grid grid-cols-12 p-3 sm:p-4 text-xs">
                      <span className="col-span-4 font-bold text-slate-500">Processor</span>
                      <span className="col-span-8 font-semibold text-slate-800">{selectedProduct.specs.processor}</span>
                    </div>
                    <div className="grid grid-cols-12 p-3 sm:p-4 text-xs">
                      <span className="col-span-4 font-bold text-slate-500">Operating System</span>
                      <span className="col-span-8 font-semibold text-slate-800">{selectedProduct.specs.os}</span>
                    </div>
                    <div className="grid grid-cols-12 p-3 sm:p-4 text-xs">
                      <span className="col-span-4 font-bold text-slate-500">Touch Interface</span>
                      <span className="col-span-8 font-semibold text-slate-800">{selectedProduct.specs.touchscreen}</span>
                    </div>
                    <div className="grid grid-cols-12 p-3 sm:p-4 text-xs">
                      <span className="col-span-4 font-bold text-slate-500">Core Alloys</span>
                      <span className="col-span-8 font-semibold text-slate-800">{selectedProduct.specs.material}</span>
                    </div>
                    <div className="grid grid-cols-12 p-3 sm:p-4 text-xs">
                      <span className="col-span-4 font-bold text-slate-500">System Inputs</span>
                      <span className="col-span-8 font-semibold text-slate-800">{selectedProduct.specs.connectivity}</span>
                    </div>
                    <div className="grid grid-cols-12 p-3 sm:p-4 text-xs">
                      <span className="col-span-4 font-bold text-slate-500">Full Dimensions</span>
                      <span className="col-span-8 font-semibold text-slate-800">{selectedProduct.dimensions}</span>
                    </div>
                    <div className="grid grid-cols-12 p-3 sm:p-4 text-xs">
                      <span className="col-span-4 font-bold text-slate-500">Prime Fitting</span>
                      <span className="col-span-8 font-semibold text-slate-800">{selectedProduct.bestFor}</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap gap-3 sm:gap-4 items-center w-full" id="product-detail-actions">
                    <button 
                      onClick={() => onOpenQuote(selectedProduct.name)}
                      className="btn-primary flex-1 sm:flex-none hover:scale-[1.03] active:scale-[0.98] duration-200 cursor-pointer text-xs sm:text-sm font-bold tracking-wide bg-accent text-white hover:bg-accent-hover px-5 py-2.5 sm:px-6 sm:py-3 flex items-center justify-center gap-2"
                      id="details-primary-quote"
                    >
                      Request Quotation For {selectedProduct.name} <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                    </button>
                    
                    <button 
                      onClick={() => setSelectedProduct(null)}
                      className="btn-outline w-full sm:w-auto hover:bg-slate-55 shadow-xs hover:scale-[1.03] active:scale-[0.98] duration-200 cursor-pointer text-xs sm:text-sm font-bold px-5 py-2.5 sm:px-6 sm:py-3 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 flex items-center justify-center gap-1.5"
                    >
                      Browse Other Designs
                    </button>
                  </div>

                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
