import React, { useMemo, useState } from 'react';
import { CheckCircle, ThumbsUp, Filter, ArrowUpRight, Quote, Star } from 'lucide-react';
import { REVIEWS } from '../data/testimonials';
import type { CustomerReview } from '../types';
import { Reveal } from './Reveal';

interface ReviewsSectionProps {
  onEnquire: () => void;
}

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({ onEnquire }) => {
  const [reviewsList, setReviewsList] = useState<CustomerReview[]>(REVIEWS);
  const [productFilter, setProductFilter] = useState<string>('All');

  // Build the chips from the reviews we actually have, so a filter can never
  // point at an empty result.
  const filters = useMemo(
    () => ['All', ...Array.from(new Set(REVIEWS.map(r => r.product)))],
    []
  );

  const filteredReviews =
    productFilter === 'All'
      ? reviewsList
      : reviewsList.filter(r => r.product === productFilter);

  const handleHelpful = (id: string) => {
    setReviewsList(prev =>
      prev.map(r => (r.id === id ? { ...r, helpfulCount: r.helpfulCount + 1 } : r))
    );
  };

  return (
    <section
      id="reviews"
      className="py-12 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-24"
    >

      {/* Header */}
      <Reveal className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
        <span className="inline-flex items-center gap-1 px-4 py-1 rounded-full bg-[#0b2545]/15 text-[#0b2545] text-xs font-black uppercase tracking-widest mb-3">
          <Star className="w-3.5 h-3.5 text-[#0284c7]" aria-hidden="true" /> 4,000+ DEPLOYMENTS
        </span>
        <h2 className="text-3xl sm:text-5xl font-black text-[#0b2545] font-condensed tracking-tight">
          TRUSTED BY ENTERPRISES &amp; RETAIL LEADERS
        </h2>
        <p className="mt-2 text-base sm:text-lg text-[#18487d]">
          What clients say after their kiosks and displays have been live for a while.
        </p>
      </Reveal>

      {/* Score summary */}
      <Reveal className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-xl border border-white mb-8 sm:mb-10 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-center">

        <div className="md:col-span-4 text-center md:text-left flex flex-col items-center md:items-start border-b md:border-b-0 md:border-r border-zinc-200 pb-6 md:pb-0 md:pr-6">
          <div className="text-5xl sm:text-6xl font-black text-[#0b2545] font-condensed leading-none">
            4.9<span className="text-2xl text-zinc-400">/5.0</span>
          </div>
          <div className="flex items-center gap-0.5 text-amber-500 mt-2" aria-label="4.9 out of 5 stars">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className="w-5 h-5 fill-current" aria-hidden="true" />
            ))}
          </div>
          <div className="text-xs font-bold text-[#18487d] mt-1">
            Based on 4,000+ client deployments
          </div>
          <div className="mt-4 text-[11px] text-sky-900 font-semibold bg-sky-100 px-3 py-1 rounded-full flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-[#0284c7]" aria-hidden="true" /> 98.4% on-time commissioning
          </div>
        </div>

        {/* Rating Breakdown Bars */}
        <div className="md:col-span-5 space-y-2">
          {[
            { stars: '5 Stars', pct: 92, count: '3,680' },
            { stars: '4 Stars', pct: 6, count: '240' },
            { stars: '3 Stars', pct: 1.5, count: '60' },
            { stars: '2 Stars', pct: 0.3, count: '12' },
            { stars: '1 Star', pct: 0.2, count: '8' }
          ].map((bar) => (
            <div key={bar.stars} className="flex items-center gap-3 text-xs font-bold text-[#0b2545]">
              <span className="w-14 text-zinc-600 flex-shrink-0">{bar.stars}</span>
              <div className="flex-1 bg-zinc-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#0b2545] h-full rounded-full transition-all duration-700"
                  style={{ width: `${bar.pct}%` }}
                />
              </div>
              <span className="w-12 text-right text-zinc-400 font-normal tabular-nums flex-shrink-0">
                {bar.count}
              </span>
            </div>
          ))}
        </div>

        {/*
          This used to open a "write a review" form that only ever wrote to local
          state — nothing reached the business. Visitors who want to say
          something are sent to the real contact details instead.
        */}
        <div className="md:col-span-3 flex flex-col items-center justify-center text-center">
          <button
            onClick={onEnquire}
            className="group w-full bg-[#0b2545] hover:bg-[#153b68] text-white py-3.5 px-5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <span>Start your project</span>
            <ArrowUpRight className="w-4 h-4 text-sky-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
          <span className="text-[10px] text-[#18487d] mt-2 leading-snug">
            Tell us the site and the screen size — we&apos;ll quote it.
          </span>
        </div>

      </Reveal>

      {/* Product filter — a single scrolling strip on phones rather than a wall of chips */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#0b2545] mb-2.5">
          <Filter className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Filter by product</span>
        </div>
        <div
          role="group"
          aria-label="Filter reviews by product"
          className="flex gap-2 overflow-x-auto no-scrollbar snap-x -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap"
        >
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setProductFilter(f)}
              aria-pressed={productFilter === f}
              className={`snap-start flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0284c7]/30 ${
                productFilter === f
                  ? 'bg-[#0b2545] text-white shadow-sm'
                  : 'bg-white/80 text-[#0b2545] hover:bg-white border border-white/60'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {filteredReviews.map((rev, i) => (
          <Reveal key={rev.id} delayStep={i % 3} className="h-full">
            <article className="h-full bg-white/95 backdrop-blur-md rounded-3xl p-6 border border-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full ${rev.avatarColor} flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0`}
                      aria-hidden="true"
                    >
                      {rev.author.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-[#0b2545] flex items-center gap-1.5">
                        <span className="truncate">{rev.author}</span>
                        {rev.verified && (
                          <CheckCircle
                            className="w-3.5 h-3.5 text-[#0284c7] flex-shrink-0"
                            aria-label="Verified client"
                          />
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-medium truncate">
                        {rev.location} • {rev.date}
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex text-amber-500 text-xs flex-shrink-0"
                    aria-label={`${rev.rating} out of 5 stars`}
                  >
                    {Array.from({ length: rev.rating }, (_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                    ))}
                  </div>
                </div>

                <div className="mb-2.5">
                  <span className="bg-sky-50 text-sky-900 border border-sky-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {rev.product}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-[#0b2545] mb-1.5 flex items-start gap-1.5">
                  <Quote className="w-3.5 h-3.5 text-[#0284c7] flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{rev.title}</span>
                </h3>

                <p className="text-xs text-[#18487d] leading-relaxed">{rev.comment}</p>
              </div>

              <div className="mt-6 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
                <span>Verified deployment</span>
                <button
                  onClick={() => handleHelpful(rev.id)}
                  className="flex items-center gap-1 text-[#0b2545] hover:text-[#0284c7] font-bold transition cursor-pointer"
                >
                  <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Helpful ({rev.helpfulCount})</span>
                </button>
              </div>
            </article>
          </Reveal>
        ))}
      </div>

    </section>
  );
};
