# Bluestar Digitech

Marketing site for **Blue Star Metacraft**, trading as **Bluestar Digitech** — an
ISO 9001:2015 certified precision sheet-metal fabricator in Peenya, Bangalore
that makes digital standees, interactive touch kiosks, touch tables, digital
podiums and LED video walls.

React 19 + TypeScript + Vite 6 + Tailwind CSS 4. Single page, no backend.

This lives inside the **signage-os** repo but is its own Vite project with its
own `node_modules` and its own build — the CMS at the repo root is the other
half. How the two fit together, and what is left to wire up, is in
[INTEGRATION.md](INTEGRATION.md).

## Run locally

Run these from this directory, not the repo root.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # -> dist/
```

## Layout

```
src/
  App.tsx                     section order for the single page
  types.ts                    shared types
  components/
    Navbar.tsx                announcement bar + sticky nav + mobile menu
    HeroSection.tsx           rotating product hero (sized to one screen)
    ClientLogos.tsx           "supplied & installed for" marquee
    CapabilityBanner.tsx      arched ribbon + capability headline
    InstallationGallery.tsx   #installations — site photos + lightbox
    ProductShowcase.tsx       #products — auto-advancing product carousel
    WhyChooseUs.tsx           #why-us — pillars + spec comparison
    ProcessSection.tsx        #process — design → fabrication → commissioning
    ReviewsSection.tsx        #reviews — DISABLED, see below
    FaqSection.tsx            #faq — accordion + FAQPage structured data
    Footer.tsx                #contact — contact cards, nav, catalogue request
    EnquiryModal.tsx          the enquiry form every "Enquire" button opens
    BrandAssets.tsx           logo lockup + hero product cross-fade
    Reveal.tsx                scroll-reveal wrapper
  hooks/
    useAutoAdvance.ts         carousel autoplay that yields to the visitor
  data/
    company.ts                address, phones, email (from the 2024 brochure)
    enquiry.ts                WhatsApp number + the message builders
    bluestarProducts.ts       the eight products + specs
    bluestarServices.ts       the six fabrication capabilities
    clients.ts                client marks
    installations.ts          site photography
    faqs.ts                   FAQ copy (also feeds JSON-LD)
    testimonials.ts           NOT LIVE — see below
assets/masters/               full-resolution PNGs, deliberately outside public/
public/                       only what ships: webp, icons, robots, sitemap
```

## Where the CTAs go

Every button used to scroll to the footer. There are now two routes, and the
label says which one it is:

| Label | Goes to |
|---|---|
| **Request a quote** / **Quote on WhatsApp** | `wa.me`, prefilled with the product, panel size and finish on screen |
| **Enquire** / **Send us your drawing** / **Talk to our engineering team** | `EnquiryModal.tsx` — name, phone, product, size, quantity, site, message |
| **Contact** (nav) | still the footer, because it is a contact link and not a CTA |

Both are built in `data/enquiry.ts`: `buildQuoteMessage` for the one-tap route,
`buildEnquiryMessage` / `buildEnquiryMailto` for the form. Change
`WHATSAPP_DIAL` there and every quote button follows.

## Before this goes live

- **Testimonials are off.** `data/testimonials.ts` and the 4.9/5 summary inside
  `ReviewsSection.tsx` were written for the template and are not attributable to
  a real client. Replace them with quotes the client can stand behind, then
  uncomment the section in `App.tsx`, the nav item in `Navbar.tsx` and a footer
  link. Leave it off otherwise.
- **Client logos need written sign-off.** `data/clients.ts` shows third-party
  trademarks (HAL, Indian Railways, ADA, Cognizant, Flipkart, Biocon, Audi).
  Drop any the client cannot evidence.
- **Confirm the WhatsApp number.** `WHATSAPP_DIAL` in `data/enquiry.ts` is the
  brochure's Sales mobile (+91 80958 51597). Every "request a quote" button on
  the site opens a `wa.me` chat with it — confirm WhatsApp is actually
  registered against that line, or point it at the one the client uses. It is
  set in one place and the whole site follows.
- **Confirm the enquiry mailbox.** `data/company.ts` uses
  `info@bluestarmetacraft.com` from the brochure. If the Digitech mailbox is
  live, change `COMPANY.email` and the whole site follows.
- **Neither form has a backend.** The enquiry form (`EnquiryModal.tsx`) and the
  catalogue form (`Footer.tsx`) both hand the composed message to the visitor's
  own WhatsApp or mail client, so a lead is only captured if they press send in
  that app — nothing is logged on our side. Point the enquiry form's `submit`
  at a POST endpoint when there is one; the payload shape is already
  `EnquiryDetails` in `data/enquiry.ts`.
- **Screen sizes** are stated as the 32"–65" panel range the brochure publishes
  for the standees, applied across the digital products. Narrow a model's
  `displaySizes` in `bluestarProducts.ts` if it is sold in a smaller subset.
- **Opening hours** in the footer are generic — the brochure does not print them.
- **No social handles.** The footer icons were removed rather than left pointing
  at instagram.com / youtube.com; see the comment in `Footer.tsx`.

## Deploying

`nginx.conf.template` serves `dist/`. It returns a real 404 for missing assets
and 301s unknown paths to `/` — do not restore a `try_files … /index.html`
catch-all, which turns every mistyped URL into a duplicate of the homepage.
