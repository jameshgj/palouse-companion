# Palouse Companion

An unofficial, open-source daily companion app for the free 8-week [Palouse Mindfulness](https://palousemindfulness.com/) MBSR course created by Dave Potter.

**Try it:** https://jameshgj.github.io/palouse-companion/ (on iPhone, open in Safari, then Share → Add to Home Screen).

## What's here

- `index.html`: the app as a standalone page. Host it on GitHub Pages, or load it in an iOS/Android web view.
- `artifact.html`: the same app for the claude.ai preview.
- `src/course.json`: every week's videos, readings, practice plan, guided practices and reflection prompts. Edit this to fix a link or add a language.
- `src/top.html`, `src/app.js`: the page and its logic. Run `python3 build.py` after editing.
- `manifest.webmanifest`, `icon-*.png`, `icon.svg`: let it install to a phone's home screen like an app.

## How it works

- **Today** builds a daily session. Each week's videos and readings are spread across six practice days, so each day is roughly 10–20 minutes of learning plus that day's formal practice and an informal-practice log. Tap Start, then step through one screen at a time. The tracker at the top shows what's done and the time left.
- **Formal practice** plays the course's guided audio or video inside the app, or runs a silent timer with bells. Afterwards you note how it went (a few tap-to-pick words and an optional note), which is the app's version of the practice sheet.
- **Pacing** follows the course: one practice day per calendar day, and each week opens seven days after the previous one began. "Get ahead" lets you watch and read early; practice stays daily.
- **Path** shows all eight weeks day by day. **Practices** has every guided meditation to use any time. **You** has your streak, totals, practice journal and progress sync.
- **Media and readings** play inside the app when it's hosted: YouTube player API with saved positions, audio from palousemindfulness.com, readings in an in-app reader. Nothing is copied; everything is shown from its original source. In the claude.ai preview, which blocks other sites, the app opens them externally and asks how far you got when you return.
- **Progress** is timestamped per item, so copies from different devices merge without loss. On claude.ai it saves to each viewer's account; elsewhere it saves on the device, and a progress code moves it.

## Roadmap

1. Wrap in a native shell (Capacitor or SwiftUI with a web view) for iOS, keeping `course.json` as the single source. Use SFSafariViewController or PDFKit for PDF readings, since iOS shows only the first page of a PDF inside a web frame.
2. Practice reminders (local notifications) and offline support.
3. Offer it to Palouse Mindfulness to adopt, adapt or distribute.

## Content and permission

All course material belongs to Palouse Mindfulness Inc. and the original creators. This project links to and displays it from its original sources, and does not copy or redistribute videos, audio or documents. Before distributing an app build, get Palouse Mindfulness's agreement, especially for using their name.

The code in this repository is MIT licensed.
