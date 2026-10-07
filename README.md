# Palouse Companion

An unofficial, open-source companion for the free 8-week [Palouse Mindfulness](https://palousemindfulness.com/) MBSR course created by Dave Potter.

It puts each week's videos, readings, guided practices and practice sheets on one screen, shows how much time the week takes, and lets you tick things off as you go.

## What's here

- `index.html`: the whole app in one file. Open it in a browser or host it on GitHub Pages.
- `src/course.json`: every week's videos, readings, practices and sheets. Edit this to fix a link or add a language; an iOS app can read the same file.
- `src/top.html`, `src/app.js`: the page and its logic. Run `python3 build.py` after editing to rebuild `index.html`.

## How it works

- **Videos** link to the course's own YouTube playlists. When hosted somewhere that allows embeds (GitHub Pages, an app web view), each video also has a "Play here" button.
- **Readings, practices and sheets** link straight to palousemindfulness.com, so content stays with its owners and stays current.
- **Time estimates**: video lengths come from the course pages. Reading times are estimates (8 minutes each unless noted). Formal practice is 30 min × 6 days and informal practice about 5 min a day, as the course recommends.
- **Picking up where you left off**: the top card shows the next thing to do in the week you were last active, today's practice, time left, and anything still open from earlier weeks. A gap of a few days gets a welcome-back note rather than a restart.
- **Progress storage**: every tick, practice day and video position carries its own timestamp, so copies from different devices merge without losing anything (latest change wins per item).
  - On claude.ai, progress saves to each viewer's private record and follows them across devices.
  - On GitHub Pages or in an app, it saves in the browser. A progress code (footer) moves it to another device.
- **YouTube**:
  - Where embedding works (GitHub Pages, an app web view), "Play here" uses the YouTube player API. It saves your position every few seconds, resumes there next time, and marks the video done at 92%.
  - Where it doesn't (sandboxed previews, or opening the YouTube app on a phone), the app remembers what you opened. When you come back it asks whether you finished, or where you stopped, and the next link starts at that spot (`&t=`). "Play all" asks which videos in the playlist you got through.

## Roadmap toward an app

1. Host on GitHub Pages and add a web app manifest and icons so it installs to a home screen.
2. Wrap in a native shell (Capacitor or SwiftUI with a web view) for iOS, keeping the JSON as the single source.
3. Add practice reminders and an in-app practice timer.
4. Offer it to Palouse Mindfulness to adopt, adapt or distribute.

## Content and permission

All course material belongs to Palouse Mindfulness Inc. and the original creators. This project only links to it and does not copy or redistribute videos, audio or documents. Before distributing any app build, get Palouse Mindfulness's agreement, especially for using their name or bundling any of their files.

The code in this repository is MIT licensed.
