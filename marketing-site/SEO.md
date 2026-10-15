# SEO — where the site stands, and what to do next

Written 15 Oct 2026. Two parts: what is already in place and needs nothing from
you, and what you have to do — including the honest answer on sitelinks, which
is the thing you asked about and the one that cannot be fixed with a tag.

---

## Part 1 — already done, nothing needed

| | |
|---|---|
| `robots.txt` | Allows everything, blocks only source maps, declares the sitemap. |
| `sitemap.xml` | Both real URLs, with `lastmod`, plus 8 product images as `image:image` entries. Valid XML. |
| Title & description | On both routes, distinct per route. |
| Canonical | Per route. `/` and `/enquire` each claim themselves. |
| Open Graph / Twitter | Full set with a real 1200×630 card, so links unfurl properly in WhatsApp, LinkedIn and X. |
| Structured data | `WebSite`, `Organization` + `LocalBusiness` (address, phone, two contact points), and `FAQPage` generated from the live FAQ copy. |
| Favicons | Six sizes from the B mark. |
| `nginx.conf.template` | Real 404s for missing assets; no soft-404 catch-all turning every typo into a duplicate homepage. |

One bug was fixed while writing this: `/enquire` had been inheriting the
homepage's title, description and canonical. A crawler reading that sees two
URLs both claiming to be the homepage, which is how the second one gets dropped
as a duplicate. Each route now sets its own.

---

## Part 2 — sitelinks: the honest answer

**What you asked for.** Searching "Bluestar Digitech" and seeing Home / About /
Products / Contact listed under the main result, clickable without opening the
site. Those are called **sitelinks**.

**The part people get told wrong.** There is no tag, no file and no Search
Console setting that produces sitelinks. Google generates them automatically,
and only when it is confident about a site's structure. You cannot request
them. Any agency that offers to "add sitelinks" is selling you something that
does not exist.

**Why this site cannot get them yet.** Sitelinks are built out of *other pages*
on your site. Right now there are two URLs:

```
/            the entire marketing site
/enquire     the enquiry form
```

Everything the nav points at — Products, Installations, Why Us, Process, FAQ,
Contact — is a `#fragment` of the homepage. Search engines discard fragments.
So from Google's side this is a one-page site, and it has nothing to build
sitelinks from.

### What would actually earn them

Split the existing sections into real pages. The content already exists and is
already written; this is a routing and layout job, not a writing one.

| Page | URL | Built from |
|---|---|---|
| Home | `/` | hero, a trimmed summary of each section |
| Products | `/products` | the product carousel, ideally one page per product later |
| Installations | `/installations` | the gallery |
| About | `/about` | Why Choose Us + How We Build + the ISO story |
| FAQ | `/faq` | the FAQ accordion, keeping the `FAQPage` schema |
| Contact | `/contact` | the footer's contact cards, as a page |
| Enquire | `/enquire` | done |

Each needs its own `<title>`, its own description, its own canonical, and a
sitemap entry. The routing mechanism is already in `App.tsx` — it is a lookup
table, and adding a route is a few lines plus one `location` block in
`nginx.conf.template`.

**Realistic expectation.** Even done perfectly, sitelinks typically appear
somewhere between a few weeks and a few months after Google has crawled and
trusted the structure, and a brand-new domain usually waits longer. Nobody can
promise a date.

**What is worth doing regardless:** those pages rank individually. A page
called "Self-Service Kiosk Manufacturer in Bangalore" can rank for that phrase
in a way that a `#products` anchor on a homepage never will. The sitelinks are
a side effect of a structure that is better anyway.

---

## Part 3 — your checklist, in order

### Before launch

1. **Point the domain and get HTTPS working.** Nothing below matters until
   `https://bluestardigitech.com` resolves.
2. **Check the live page source** for `<title>`, description and canonical —
   they are injected by JavaScript, so confirm they are right in the browser,
   not just in the file.

### Day one after launch

3. **Google Search Console** — <https://search.google.com/search-console>
   - Add the property. Choose **Domain** if you can edit DNS (covers www and
     non-www, http and https at once); otherwise **URL prefix** with the exact
     `https://bluestardigitech.com/`.
   - Verify. The DNS TXT record method is the one that survives redeploys.
   - **Sitemaps** → submit `sitemap.xml`.
   - **URL Inspection** → paste the homepage → **Request indexing**. Repeat for
     `/enquire`.
4. **Bing Webmaster Tools** — <https://www.bing.com/webmasters>. Can import
   straight from Search Console. Worth ten minutes; it also feeds ChatGPT
   search.
5. **Google Business Profile** — <https://business.google.com>. For a Bangalore
   manufacturer this will send more enquiries than anything else on this list.
   Use the exact same name, address and phone as the site footer, pick the
   factory address in Peenya, add photos of real installations.

### First month

6. **Watch Search Console → Pages** for anything reported "Crawled – currently
   not indexed" or "Duplicate".
7. **Check Core Web Vitals** in Search Console once it has data. The site is
   static and light, so this should be clean.
8. **Decide on the multi-page split** above. This is the sitelinks work.

### Things to decide, not technical

9. **Client logos** — HAL, Indian Railways, ADA, Cognizant, Flipkart, Biocon,
   Audi are on the homepage. Get written sign-off or remove them.
10. **Two installation photos** carry other companies' branding — Carrefour /
    Majid Al Futtaim, and an ASUS logo. Confirm they are your installations and
    that you may show them.
11. **Testimonials are switched off** because the ones in the code were written
    for the template. Real quotes would help both conversion and the
    `Review` structured data.

---

## Part 4 — what not to bother with

- **Meta keywords.** Ignored by every search engine since roughly 2009.
- **Submitting to hundreds of directories.** Spam signal, not a ranking one.
- **Sitelinks search box markup.** Google retired that feature; the markup no
  longer does anything.
- **Anyone promising "#1 on Google" or guaranteed sitelinks.** Neither is
  purchasable.

---

## Keeping the sitemap honest

`public/sitemap.xml` is written by hand. It currently lists two URLs and eight
product images. Two rules:

- **Add a `<url>` entry whenever a route is added to `App.tsx`.** A route that
  is not in the sitemap is a page Google may never find.
- **Update `<lastmod>` when a page's content actually changes** — not on every
  deploy. A sitemap that claims everything changed today gets its `lastmod`
  ignored entirely.

The same applies to `nginx.conf.template`: every real route needs a `location`
block, or a direct visit or refresh on that URL will 301 to the homepage.
