# Palouse Companion

An unofficial, open-source companion for the free 8-week [Palouse Mindfulness](https://palousemindfulness.com/) MBSR course created by Dave Potter.

It puts each week's videos, readings, guided practices and practice sheets on one screen, shows how much time the week takes, and lets you tick things off as you go.

## What's here

- `index.html`: the whole app, one file with no build step. Open it in a browser or host it on GitHub Pages.
- Course content lives in the `<script id="course-data" type="application/json">` block inside `index.html`. Edit that JSON to fix a link or add a language. A future iOS app can read the same structure.

## How it works

- **Videos** link to the course's own YouTube playlists. When hosted somewhere that allows embeds (GitHub Pages, an app web view), each video also has a "Play here" button.
- **Readings, practices and sheets** link straight to palousemindfulness.com, so content stays with its owners and stays current.
- **Time estimates**: video lengths come from the course pages. Reading times are estimates (8 minutes each unless noted). Formal practice is 30 min × 6 days and informal practice about 5 min a day, as the course recommends.
- **Progress** is saved in the browser's local storage. Nothing is sent anywhere.

## Roadmap toward an app

1. Host on GitHub Pages and add a web app manifest and icons so it installs to a home screen.
2. Wrap in a native shell (Capacitor or SwiftUI with a web view) for iOS, keeping the JSON as the single source.
3. Add practice reminders and an in-app practice timer.
4. Offer it to Palouse Mindfulness to adopt, adapt or distribute.

## Content and permission

All course material belongs to Palouse Mindfulness Inc. and the original creators. This project only links to it and does not copy or redistribute videos, audio or documents. Before distributing any app build, get Palouse Mindfulness's agreement, especially for using their name or bundling any of their files.

The code in this repository is MIT licensed.
