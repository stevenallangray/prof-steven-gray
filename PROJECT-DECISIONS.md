# Website project decision log — November 11–13, 2026

This document preserves **editorial decisions, user-provided nuance, work status, and verification gaps** from the professional website rebuilding effort. It is a decision record, not a transcript or an assertion that all proposed changes are live.

## Source control and implementation
- Repository: `stevenallangray/prof-steven-gray`.
- Work on `website-review`; leave `main` and public deployment alone unless explicitly asked to publish.
- Prior snapshot: `website-review` was 67 commits ahead of `main` and 0 behind (November 13).
- Content source: `content/site-content.json`; schema `content/site-content.schema.json`; `npm run validate` checks and regenerates `content/site-content.js`.
- Site variant: `variants/concept-map`, with `index.html`, `app.js`, `style.css`. For copy changes, edit the content source rather than variant layout code.
- Preserve stable IDs and internal people/publication/tag references. Refer to `content/AGENT-GUIDE.md` and `content/EXTRACTION-ISSUES.md`. Avoid rerunning one-off extraction scripts.
- Earlier lab site reference: http://lab.mentalmodeler.com/#home.

## Site architecture: APPROVED
Exactly five sections: **Home, About, People, Publications, Software**. Remove standalone News and Teaching. Legacy mentions in schema or variant are not evidence implementation is complete; inspect rendered output.

## Home: exact approved copy
> We study how diverse ways of knowing influence environmental decisions, and how collective intelligence and computational approaches can help people navigate making effective decisions within complex social–ecological systems.

Do not replace this with generic sustainability prose. Identity: participatory and computational modeling, multiple forms of knowledge, collective intelligence and complex social–ecological decision-making.

## About
- Represent an established trajectory from knowledge elicitation and participatory/fuzzy cognitive modeling to collective intelligence and decision support; identify the emerging theoretical work on **when** knowledge diversity improves adaptation, without treating proposed research as already demonstrated.
- Acknowledge Professor appointment at Michigan State University and a distinct **paid research appointment** as Research Scientist in Johns Hopkins Whiting School of Engineering, **funded through NIST**. Do not label honorary or infer full-time status.
- Include **Selected Research Support** for 4–6 projects; the final exact selection is pending. Do not arbitrarily choose grants in lieu of user approval.

## People
- **Exactly three current students**. Two MS students need their updated photos and concise bios; do not portray alumni as current members.
- Proposed display: PI, Current Graduate Researchers, and Lab Alumni.
- Alumni should have compact **text-only** entries, **no photographs**, avoiding convoluted historical bios but retaining name, degree/year where verified, and **where they work now**.
- Every supplied career correction, external profile link, award, degree, employer and location should be verified; do not infer titles from obsolete material.
- Specific recent references supplied:
  - Molly Miller — https://www.linkedin.com/in/molly-miller-ph-d-47825a97/ ; https://coastalfisheries.org/maine-center-for-coastal-fisheries-is-on-the-move-introducing-new-team-members/
  - World Travel Awards video supplied in connection with alumni updates — https://www.worldtravelawards.com/video/5704 ; verify award recipient and relationship rather than assuming.
  - Mary Pleasant — https://www.linkedin.com/in/mary-pleasant-957b66111/
  - USDA/UVM postdoctoral researcher profile — https://scholar.google.com/citations?user=NxaLA5wAAAAJ&hl=en ; verify matching person's identity.
  - Chelsea Wentworth — https://chmfamilymedicine.msu.edu/people/chelsea-wentworth
- This log does **not** claim every one-off biographical correction has been exhaustively reconstructed. Audit the underlying conversations and entries for exact text.

## Publications
- Aim for **complete** scholarly record: journal papers, books, book chapters, and selected reports; distinguish published, in press, in revision, and under review.
- The revised publication working set was reported as **134 entries: 126 published, 3 in press, 4 under review, 1 in revision**; **five duplicates merged** and **nine legacy records corrected**.
- This remains **draft verification work**, not a clean final database: reported audit flags include **93 metadata issues, 52 unstructured author fields, and 91 DOI links not verified**, with validation and browser review incomplete.
- Publication artifacts recorded in earlier work include `publications-revised-quality-report.md`, `gray-publications-verification-log.md`, and `site-content-publications-REVISED-focusing-retained.json`. Compare these against the canonical repository JSON; do not assume merged.
- Preserve exact author order, titles, venues, dates, types, author identity, DOIs, and external links. Do not invent missing information.

## Software
- Describe Mental Modeler as **freely available software** for participatory modeling and fuzzy cognitive mapping and explain its scholarly and practical purpose.
- Do not make unverified claims about new features. The contemplated modernization/analytics integration is not necessarily a shipped capability; do not mix software description with a commercial consulting offer.

## Continuing-work checklist (not completed by writing this log)
- Audit live/rendered five-section navigation and mobile layout.
- Confirm all people entries and source URLs, including award attribution and current employer.
- Reconcile 134-item publication draft and outstanding bibliographic issues with `content/site-content.json`; run `npm run validate` and visually review publication filters.
- Select 4–6 Research Support items.
- Verify final copy and branch-to-deployment workflow before publishing.

## How to maintain this record
For each new change record date, section, exact approved wording, source URL (when relevant), whether proposed/implemented/verified, and commit link. Treat Git history and user's exact editorial input as authoritative; do not pretend a summary is a verbatim archive.
