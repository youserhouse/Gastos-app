# Security Notes

## Firebase Config

The `firebaseConfig` object in `app.js` contains API keys and project identifiers.
Firebase client-side keys are **restricted by domain** in the Firebase Console — they are
not secret, but you should still restrict them to your deployment domain via
[Firebase Console → Project Settings → API key restrictions](https://console.firebase.google.com).

For production, consider moving config to a `config.local.js` file excluded from git
(see `.env.example`).

---

## Anthropic API Key — HIGH RISK

### The Problem

`callClaudeReceipt()` in `app.js` calls the Anthropic API **directly from the browser**,
meaning the API key is visible to anyone who opens DevTools or shares the app URL.

```js
// app.js — current (insecure) pattern
headers: { 'x-api-key': apiKey, ... }  // apiKey stored in localStorage
```

This key grants full access to your Anthropic account and can rack up charges if leaked.

### Recommended Solution

Replace the direct client call with a **server-side proxy**. Two lightweight options:

#### Option A — Firebase Cloud Function (recommended if you already use Firebase)

```js
// functions/index.js
const { onCall } = require('firebase-functions/v2/https');
const Anthropic = require('@anthropic-ai/sdk');

exports.analyzeReceipt = onCall(async (request) => {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: request.data.messages }]
  });
  return response.content[0].text;
});
```

Store the key with: `firebase functions:secrets:set ANTHROPIC_API_KEY`

#### Option B — Cloudflare Worker (zero-cost tier, no Firebase required)

```js
// worker.js
export default {
  async fetch(request, env) {
    const body = await request.json();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    return new Response(await res.text(), { headers: { 'content-type': 'application/json' } });
  }
};
```

Set the key in: Cloudflare Dashboard → Worker → Settings → Variables → Secrets

### In the meantime

The app shows a warning banner in the scanner UI. Users should never share the app URL
with people they don't fully trust while a key is configured.
