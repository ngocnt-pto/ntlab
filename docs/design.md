# Gõ Mây — local Vietnamese typing demo

## Revised product direction (latest user steering)

Replace garden-first UI with high-contrast guided touch typing. The first minute is quick Vietnamese sample -> evidence-only results -> meaningful home-row demo with highlighted keyboard + two SVG hands -> 50,000 VND unlock preview. No inferred finger diagnosis, guaranteed learning duration, invented WPM improvement, or unsupported time savings. Words advertised as home-row must actually use those keys (e.g. `da ga ha la sa`; not `nhà`, which needs N).

15 days, 3 real exercises each. Day 1 free and all other days Plus. Guided physical-key exercises use a readonly focusable input and keydown to avoid the OS IME consuming Telex practice sequences; free-text exercises use native IME and word-level grading. Finger mapping follows QWERTY; highlight exact hand/finger and opposite Shift. Foundation drills remain available after the short meaningful first exercise. Telex arrives on day 1 as fixed sequences, with fuller practice on days 3/6; text exercises follow.

Five synthesized optional sound profiles, immediate audible feedback after a user gesture, mute always available. Child/office text variants, local results, export, settings. A printable Telex/finger cheat sheet is real downloadable content. Purchase UI has a clear DEMO QR placeholder, amount and non-billable reference; no fake QR or paid entitlement. Manual demo unlock is explicitly local, no payment or login required. Google login remains marked unavailable until Firebase is integrated. Real QR verification and payment recovery need a backend and cannot be secured with localStorage.

Earlier garden notes below describe the initial draft and are superseded by this section.

Approved direction: the user requests immediate implementation of the discussed lightweight local HTML/CSS/JavaScript product. No hosted service, paid purchase, or real account is created.

- Vietnamese interface, original SVG garden, animated rabbit, illustrated QWERTY keyboard, finger colors, optional calm mode and sound.
- Vietnamese text is entered with the operating system keyboard/IME. Do not build another Telex engine. Unfinished words are provisional; judge words at spaces and finish on an exact final sentence. Normalize NFC before comparing. Composition events suppress evaluation until composition ends. Native IME behavior still needs testing on an actual Vietnamese keyboard.
- Six free lessons and six visibly locked Plus lessons. Trial has no countdown and free lessons remain replayable. A clearly labeled local Plus preview can be enabled and reset without money or real authentication.
- Practice, lesson roadmap, progress, settings, local account explanation, and result dialogs are functional. Settings and bounded result history persist locally with safe fallback when storage is unavailable.
- Separate pure typing logic, lesson data, local services, and UI. Services expose the future boundary for Firebase Auth/Firestore and server-verified entitlements. No Firebase dependency until configuration exists. Do not simulate successful Google login.
- Works from index.html and via a loopback-only dependency-free Node server. All visual assets and fonts are local/system; no CDN.
- Responsive desktop-first layout, keyboard focus, reduced-motion support, readable Vietnamese, accessible dialogs. No claimed client-side license security.

Verification: Node unit tests cover Vietnamese normalization, pending accents, correction, extra words, completion, scoring, storage corruption, and free/Plus access. Browser tests cover navigation, completion, persistence, plan preview/reset, responsive layouts, console errors, and composition handling. Inspect desktop/mobile screenshots.
