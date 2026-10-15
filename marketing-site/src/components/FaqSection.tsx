import React, { useState } from 'react';
import { ChevronDown, HelpCircle, ArrowUpRight } from 'lucide-react';
import { FAQS } from '../data/faqs';
import { Reveal } from './Reveal';

interface FaqSectionProps {
  onEnquire: () => void;
}

/**
 * Google's FAQ rich result needs the same Q&A that the visitor sees. Building it
 * from FAQS here rather than hand-writing it into index.html means the two can
 * never drift apart when a question is edited.
 */
const faqJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(faq => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: { '@type': 'Answer', text: faq.answer }
  }))
});

export const FaqSection: React.FC<FaqSectionProps> = ({ onEnquire }) => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section
      id="faq"
      className="py-12 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto scroll-mt-24"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />

      {/* Header */}
      <Reveal className="text-center mb-10 sm:mb-12">
        <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-[#0b2545]/15 text-[#0b2545] text-xs font-black uppercase tracking-widest mb-3">
          <HelpCircle className="w-3.5 h-3.5 text-[#0284c7]" /> COMMON QUESTIONS
        </span>
        <h1 className="text-3xl sm:text-5xl font-black text-[#0b2545] font-condensed tracking-tight">
          FREQUENTLY ASKED QUESTIONS
        </h1>
        <p className="mt-2 text-base text-[#18487d]">
          Custom branding, warranties, lead times and specifications — the things people ask us first.
        </p>
      </Reveal>

      {/* Accordion List */}
      <div className="space-y-3">
        {FAQS.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <Reveal key={faq.question} delayStep={idx}>
              <div
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isOpen
                    ? 'bg-white shadow-md border-[#0b2545]/30'
                    : 'bg-white/80 hover:bg-white border-white/60 shadow-sm'
                }`}
              >
                <h3>
                  <button
                    onClick={() => toggle(idx)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${idx}`}
                    id={`faq-question-${idx}`}
                    className="w-full px-5 sm:px-6 py-4 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-[#0b2545] cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0284c7]/30 rounded-2xl"
                  >
                    <span>{faq.question}</span>
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                        isOpen ? 'bg-[#0b2545] text-white rotate-180' : 'bg-[#0b2545]/8 text-[#0b2545]'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" aria-hidden="true" />
                    </span>
                  </button>
                </h3>

                {isOpen && (
                  <div
                    id={`faq-answer-${idx}`}
                    role="region"
                    aria-labelledby={`faq-question-${idx}`}
                    className="animate-accordion px-5 sm:px-6 pb-5 pt-3 text-xs sm:text-sm text-[#18487d] leading-relaxed border-t border-zinc-100"
                  >
                    {faq.answer}
                  </div>
                )}
              </div>
            </Reveal>
          );
        })}
      </div>

      {/* Anything not covered above */}
      <Reveal className="mt-8 text-center">
        <p className="text-sm text-[#18487d]">
          Still have a question about your project?
        </p>
        <button
          onClick={onEnquire}
          className="group mt-3 inline-flex items-center gap-2 bg-[#0b2545] hover:bg-[#153b68] text-white px-6 py-3 rounded-full text-xs sm:text-sm font-bold shadow transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer"
        >
          <span>Talk to our engineering team</span>
          <ArrowUpRight className="w-4 h-4 text-sky-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </Reveal>

    </section>
  );
};
