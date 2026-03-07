# Deploying Solar Advisor to Streamlit Community Cloud

Streamlit Community Cloud (free tier) hosts the app publicly with no server to manage.
The entire deployment takes about 10 minutes.

---

## Prerequisites

- A GitHub account with access to `github.com/rgutzen/solarflower-app`
- The repo must be **public** (it is — AGPL-3.0 open source)
- A Streamlit Cloud account at [streamlit.io/cloud](https://streamlit.io/cloud)
  (sign in with your GitHub account — no separate sign-up needed)

---

## Step 1 — Push latest code to GitHub

Make sure all local changes are committed and pushed:

```bash
cd /home/rgutzen/01_PROJECTS/solarflower-app
git add -A
git commit -m "Add Streamlit Cloud config and deployment guide"
git push origin main
```

Verify that `solar-app/.streamlit/config.toml` is tracked (not gitignored):

```bash
git ls-files solar-app/.streamlit/
# Should print: solar-app/.streamlit/config.toml
```

---

## Step 2 — Create the app on Streamlit Cloud

1. Go to [share.streamlit.io](https://share.streamlit.io) and sign in with GitHub.
2. Click **"New app"** (top right).
3. Fill in the form:

   | Field | Value |
   |-------|-------|
   | Repository | `rgutzen/solarflower-app` |
   | Branch | `main` |
   | Main file path | `solar-app/app.py` |
   | App URL (optional) | `solarflower` → becomes `solarflower.streamlit.app` |

4. Click **"Deploy"**.

Streamlit Cloud reads `solar-app/requirements.txt` automatically because it is
in the same directory as `app.py`.

The first deploy takes 3–5 minutes (installs pvlib, scipy, etc.).
Subsequent redeploys are faster.

---

## Step 3 — Note the public URL

After deployment, your app URL will be one of:
- `https://solarflower.streamlit.app` (if the short name was available)
- `https://rgutzen-solarflower-app-solar-app-app-XXXX.streamlit.app` (auto-generated)

You can find and copy it from the Streamlit Cloud dashboard.

---

## Step 4 — Update the website

Open `website/solar-advisor.html` and replace the `APP_URL` constant:

```js
// Before:
const APP_URL = 'http://localhost:8501';

// After:
const APP_URL = 'https://solarflower.streamlit.app';
```

Also update the `href` of the "Open in new tab" link and the URL bar display text:

```html
<!-- Before: -->
<span class="embed-frame__url" id="frame-url">http://localhost:8501</span>
<a href="http://localhost:8501" ...>

<!-- After: -->
<span class="embed-frame__url" id="frame-url">solarflower.streamlit.app</span>
<a href="https://solarflower.streamlit.app" ...>
```

Similarly update the shell code block in the embed instructions section if you
want to point users to the live URL instead of localhost.

Commit and push the updated website file.

---

## Known issues and workarounds

### PVGIS API rate limiting
PVGIS (re.jrc.ec.europa.eu) has generous rate limits for typical use, but
all users share the same outbound IP on Streamlit Cloud. If requests fail:
- The app automatically falls back to **Open-Meteo** (same quality, different source)
- If both fail, a clear-sky model is used as a last resort
- No action needed; the fallback chain is already implemented in `core/climate.py`

### Iframe embedding and X-Frame-Options
Streamlit Cloud sets `X-Frame-Options: SAMEORIGIN` by default, which blocks
cross-origin iframes. The `solar-app/.streamlit/config.toml` already sets
`enableCORS = false` and `enableXsrfProtection = false`, which disables the
same-origin iframe restriction on Streamlit's own server-level config.

However, Streamlit Cloud's reverse proxy may re-add the header. If the iframe
on `solar-advisor.html` shows a blank page or "refused to connect" error:
1. Verify the app loads directly at its URL (rule out a build error)
2. As a fallback, change the website button to open in a new tab instead of
   an inline iframe — that always works regardless of X-Frame-Options

### Python version
Streamlit Cloud defaults to Python 3.12, matching the dev environment.
If you need to pin it explicitly, add a `.python-version` file at the repo root:

```bash
echo "3.12" > .python-version
git add .python-version && git commit -m "Pin Python 3.12 for Streamlit Cloud"
git push
```

### Free tier limits
- 1 GB RAM per app (sufficient: typical simulation uses ~200 MB)
- Apps **sleep after 7 days of inactivity** (cold start takes ~30 s on wake)
- 1 app per account on the free tier (paid plans allow more)

---

## Updating the deployed app

Every `git push origin main` automatically triggers a redeploy on Streamlit Cloud.
No manual action needed after the initial setup.

To force a redeploy without a code change (e.g., to clear the package cache),
go to the app dashboard → three-dot menu → **"Reboot app"**.
