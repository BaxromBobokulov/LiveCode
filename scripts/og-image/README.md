# og:image source

`og-image.html` is the source of `public/og-image.png`, the 1200x630 picture Telegram, Google and other sites show when someone shares a link to livecode.uz.

To render it again after you change the HTML (Windows, Chrome installed), run this from the repo root:

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1200,630 --virtual-time-budget=8000 \
  --screenshot="$PWD/public/og-image.png" "file:///$PWD/scripts/og-image/og-image.html"
```

The page loads IBM Plex from Google Fonts, so you need to be online. Check the result is still 1200x630.

Telegram caches link previews. After you replace the image, send the link to @WebpageBot to refresh it.
