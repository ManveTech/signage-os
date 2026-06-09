export interface Product {
  id: string;
  name: string;
  categoryId: string;
  headline: string;
  description: string;
  imageUrl: string;
  features: string[];
  specs: {
    display: string;
    processor: string;
    os: string;
    touchscreen: string;
    material: string;
    connectivity: string;
  };
  dimensions: string;
  material: string;
  bestFor: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const categories: Category[] = [
  {
    id: "kiosks",
    name: "Interactive & Self-Service Kiosks",
    description: "Sleek, rugged freestanding terminal systems optimized for direct customer check-ins, ticketing, bill payments, and wayfinding automation.",
    icon: "Monitor"
  },
  {
    id: "displays",
    name: "Digital Standees & Smart Displays",
    description: "Immersive high-contrast digital display systems featuring continuous 24/7 commercial operation, crystal clear visuals, and integrated players.",
    icon: "Tv"
  },
  {
    id: "smart-tables",
    name: "Collaborative Interactive Tables",
    description: "Spill-proof, scratch-resistant multi-touch surfaces engineered for corporate collaboration, visual dashboards, and premium experience lounges.",
    icon: "LayoutGrid"
  },
  {
    id: "podiums",
    name: "Smart Podiums & Presentation Hubs",
    description: "Professional digital speaker podiums featuring customizable touch interfaces, integrated audio control, and motorized height adjustments.",
    icon: "Mic"
  }
];

export const products: Product[] = [
  {
    id: "kiosk-k100",
    name: "SignageOS K100 Wayfiller",
    categoryId: "kiosks",
    headline: "The Gold Standard in Mall & Venue Digital Directory",
    description: "The SignageOS K100 is engineered for high-traffic environments, providing robust multi-touch wayfinding guides. Encased in a flawless dust-proof laser-cut sheet steel capsule, it is highly durable and energy efficient.",
    imageUrl: "https://picsum.photos/seed/kiosk-k100/600/450",
    features: [
      "Vandal-resistant standard 55-inch projected capacitive display",
      "Dynamic directional wayfinding rendering and compass guide",
      "Sealed dual cooling exhaust for 24/7 operation safety",
      "Hidden floor anchor bracket system for high stability"
    ],
    specs: {
      display: "55\" Ultra-HD IPS, 450 Nits, 10-point capacitive touch",
      processor: "Intel Core i5 (9th Gen) Quad-Core",
      os: "Windows 11 IoT Enterprise / Android 11",
      touchscreen: "PCT Touch (2mm tempered premium protective glass)",
      material: "Precision-bent 1.6mm SPCC commercial carbon steel",
      connectivity: "Gigabit Ethernet, Wi-Fi 6, LTE cellular backup"
    },
    dimensions: "1850mm (H) x 820mm (W) x 120mm (D)",
    material: "CNC bent carbon steel with industrial textured powder coating",
    bestFor: "Shopping malls, airports, transit intersections, and hospital wayfinding."
  },
  {
    id: "kiosk-s300",
    name: "SignageOS S300 Express Check-In",
    categoryId: "kiosks",
    headline: "Automate Registrations, Ticketing & Visitor Logs",
    description: "Perfect for hotel receptions, hospital patient intakes, government offices, and amusement ticketing, the S300 delivers low maintenance self-service workflows with custom integrated barcode readers and thermal printers.",
    imageUrl: "https://picsum.photos/seed/kiosk-s300/600/450",
    features: [
      "Custom integrated 80mm industrial high-speed thermal roll printer",
      "Integrated omnidirectional 2D barcode & QR scanner",
      "Optional camera & payment terminal integration slots",
      "Double lock access rear cabinet doors for safe maintenance access"
    ],
    specs: {
      display: "22\" Full HD Display, 350 Nits, 10-point multi-touch",
      processor: "ARM Hexa-core / Intel Pentiums Gold Grade",
      os: "Android 10 / Windows 10 IoT Pro",
      touchscreen: "Projected Capacitive Surface Touch",
      material: "Anti-corrosion galvanized sheet metal with dual locks",
      connectivity: "Ethernet, Dual band wireless, RS232, USB"
    },
    dimensions: "1480mm (H) x 480mm (W) x 180mm (D)",
    material: "Galvanized sheet steel with custom accent vinyl wraps available",
    bestFor: "Corporate reception logs, healthcare intake, quick ticketing booths, and parking pay points."
  },
  {
    id: "kiosk-p500",
    name: "SignageOS Pay500 Utility Terminal",
    categoryId: "kiosks",
    headline: "Ultra-secure Cash & Card Municipal Payment Gateway",
    description: "The Pay500 is custom fabricated to withstand heavy public abuse while housing sensitive cash bill acceptors, dual key safes, and EMV credit card terminals. It is absolute proof of our high-tolerance metal fabrication craftsmanship.",
    imageUrl: "https://picsum.photos/seed/kiosk-p500/600/450",
    features: [
      "Thick premium reinforced security casing (2.5mm cold rolled steel)",
      "Multi-denomination cash validator with lockable 1000-bill vault stacker",
      "EMV Compliant chip & pin card terminal mountings",
      "Live hardware state sensors and automated power backup module"
    ],
    specs: {
      display: "19\" High-Contrast Commercial Display (IK08 impact resistant)",
      processor: "Intel Core i3 Enterprise Tier",
      os: "Windows 11 LTSC secure framework",
      touchscreen: "Pressure sensitive surface acoustic glass barrier",
      material: "2.5mm High-tensile armored steel safety casing",
      connectivity: "Encrypted VPN Tunnel, Hardware Firewall, Gigabit LAN"
    },
    dimensions: "1620mm (H) x 550mm (W) x 420mm (D)",
    material: "Reinforced armored steel plate, finished with anti-scratch coating",
    bestFor: "Government bill payment spots, civic utility centers, and outdoor ticketing hubs."
  },
  {
    id: "display-standee-a600",
    name: "Aura Glass Ultra-Thin Standee",
    categoryId: "displays",
    headline: "Next Generation Single & Double Sided Visual Signage",
    description: "Upgrade from poster standees to the absolute pinnacle of premium retail atmosphere. Featuring a seamless glass panel facade, minimal edge bezels, and extremely bright displays designed to catch eyes under indoor showroom lighting.",
    imageUrl: "https://picsum.photos/seed/standee-a600/600/450",
    features: [
      "Jaw-dropping slim casing (only 45mm total structural depth)",
      "Optional double-sided high panel synchronized visual output",
      "Automated brightness control timer for evening power saving",
      "Heavy weighted safety tempered glass platform footing"
    ],
    specs: {
      display: "55\" or 65\" High Brightness (700 Nits) continuous Panel",
      processor: "Integrated Android Cortex-A55 Media SoC",
      os: "Custom SignageOS Cloud Signage OS / Android 11",
      touchscreen: "Non-touch visual display (Capacitive Touch available on request)",
      material: "Premium extruded aluminum alloy trim frame, tempered facade",
      connectivity: "Cloud CMS sync via Wi-Fi 6, RJ45 port, content upload USB"
    },
    dimensions: "1910mm (H) x 760mm (W) x 45mm (D)",
    material: "Extruded aerospace aluminum with safety tempered glass cover",
    bestFor: "Luxury car showrooms, high-end apparel retailers, airport duty-free centers, and hotels."
  },
  {
    id: "display-led-v10",
    name: "V10 Command LED Matrix Wall",
    categoryId: "displays",
    headline: "Seamless Micro-Pitch Videowalls for Demanding Monitoring",
    description: "Designed for continuous security, command dashboards, and commercial advertisements, SignageOS modular LED walls combine stunning clarity, absolute panel alignment, and a completely fanless silent design.",
    imageUrl: "https://picsum.photos/seed/led-matrix-v10/600/450",
    features: [
      "Fine micro bezel panels with continuous custom pixel layouts",
      "Completely silent front-access quick-service modular frame rails",
      "Ultra-low latency rendering, perfect for CCTV feeds and metrics",
      "Highly efficient heat dissipation structure keeps electronics cool"
    ],
    specs: {
      display: "Fine-pitch LED (options for P0.9, P1.2, and P1.5 pixel options)",
      processor: "Novastar Controller Systems integrated sync console",
      os: "Cross-compatible master controller inputs (HDMI, DisplayPort)",
      touchscreen: "Non-Touch ambient videowall grid",
      material: "Die-cast lightweight aluminum structural panels",
      connectivity: "Gigabit fiber receiver nodes, redundant power grids"
    },
    dimensions: "Custom modular setup (commonly 600mm x 337.5mm per panel)",
    material: "Die-cast high accuracy aluminum frame mounts",
    bestFor: "Security operations center (SOC), boardroom display system, dynamic product halls."
  },
  {
    id: "table-nexus-x",
    name: "Metacraft Touch-Table Nexus",
    categoryId: "smart-tables",
    headline: "High-Interaction Showcase Interactive Boardroom Solution",
    description: "The Nexus transforms presentations from boring slide shows to fully collaborative experiences. Perfect for design teams, construction blueprints, and immersive product showrooms, featuring high-speed optical touch processing and spill-safe design.",
    imageUrl: "https://picsum.photos/seed/table-nexus-x/600/450",
    features: [
      "Waterproof, scratch-proof premium Chemically Strengthened Glass",
      "Accurate 40-point touch tracking (supports multiple users simultaneously)",
      "Concealed pneumatic cable management columns for wire-free look",
      "Tilt-adjustable motor columns (0 to 45 degree active angle range)"
    ],
    specs: {
      display: "65\" UHD 4K Flat Panel IPS, high contrast color",
      processor: "Intel i7 Business Suite with Dedicated Nvidia GPU",
      os: "Windows 11 Pro multi-touch customized suite",
      touchscreen: "Interactive Glass multi-touch PCT (IP65 front-face rating)",
      material: "Electroplated heavy structural steel floor plates",
      connectivity: "Concealed HDMI out, USB-C desk connection, Wi-Fi 6"
    },
    dimensions: "820mm (H) x 1650mm (W) x 980mm (D)",
    material: "Brushed architectural grade stainless steel base and thick glass trim",
    bestFor: "Architectural consultancy, command centers, luxury showroom catalogs, interactive training."
  },
  {
    id: "podium-apex-p100",
    name: "Apex Smart Digital Podium",
    categoryId: "podiums",
    headline: "The Ultimate Speaking Terminal for Auditoriums and Executive Halls",
    description: "A perfect blending of classic speaking authority and modern presentation convenience. Apex features automated screen controls, integrated audio mixing interfaces, and a motorized mechanism that quietly adapts to any speaker's height.",
    imageUrl: "https://picsum.photos/seed/podium-apex-p100/600/450",
    features: [
      "Secondary custom presentation control screen panel on top desktop",
      "Professional quick-mute cardioid pattern microphone on shock mount",
      "Silent active height configuration with digital memory buttons",
      "Integrated front logo display customizable with client logos"
    ],
    specs: {
      display: "24\" Core Interactive Console Screen + 10\" system controller panel",
      processor: "Embedded i5 Presentation Media Controller",
      os: "Dual-OS secure presentation hub (Windows / Android OS)",
      touchscreen: "10-point capacitive glass front console",
      material: "Solid solid wood finishes panel paired with CNC folded steel",
      connectivity: "Hidden cable ports for dynamic HDMI inputs, XLR mic output, power socket"
    },
    dimensions: "1150mm - 1380mm (Motorized Height Adjustable) x 750mm x 600mm",
    material: "Sleek combination of architectural aluminum and premium dark oak trims",
    bestFor: "University lecture theaters, parliament venues, corporate auditoriums, and press clubs."
  }
];
