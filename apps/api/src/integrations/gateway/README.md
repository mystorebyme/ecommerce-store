# Gateway integration — observer setup (self-hosted UPI)

Is folder ka kaam: bank ka credit **padhna** aur gateway ko batana. Paisa aapke apne VPA par
aata hai; koi aggregator nahi.

## 1. Android SMS observer (recommended)

Merchant ke phone par ek chhota Android app (`BroadcastReceiver` for `SMS_RECEIVED`):

```kotlin
// 1. bank sender allow-list (e.g. "HDFCBK", "ICICIB", "AXISBK", "PAYTM")
// 2. body ko jaisa hai waisa bhejo — parsing server karta hai
val body = JSONObject()
  .put("source", "ANDROID_SMS")
  .put("deviceId", Build.MODEL + "-" + Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID).take(6))
  .put("messageId", smsTimestamp.toString() + "-" + bodyText.hashCode())
  .put("rawText", bodyText)
  .put("observedAt", Instant.ofEpochMilli(smsTimestamp).toString())

val raw = body.toString()
val sig = "sha256=" + hmacSha256Hex(raw, BuildConfig.OBSERVER_SHARED_SECRET) // HmacSHA256
okhttp.newCall(Request.Builder()
  .url(BuildConfig.API_URL + "/api/v1/observers/observations")
  .post(raw.toRequestBody("application/json".toMediaType()))
  .header("x-observer-signature", sig)
  .build()).execute()
```

Rules:
- Sirf bank senders padho, baaki SMS ignore.
- `messageId` unique rakho (timestamp + hash) — retry par duplicate na ho.
- Fail ho to **exponential backoff** ke saath retry (WorkManager).
- Network error par SMS discard mat karo — local queue me rakho.

## 2. Gmail watcher (backup / cross-source)

Bank ke email alerts ko `GMAIL` source ke saath bhejo (Apps Script trigger ya cron):

```js
// Apps Script — har 1 minute
const SECRET = PropertiesService.getScriptProperties().getProperty('OBSERVER_SECRET');
const thread = GmailApp.search('from:(alerts@hdfcbank.net) is:unread newer_than:10m');
for (const t of thread) {
  for (const m of t.getMessages()) {
    const raw = JSON.stringify({
      source: 'GMAIL',
      deviceId: 'gmail-appsscript',
      messageId: m.getId(),
      rawText: m.getPlainBody().slice(0, 900),
    });
    UrlFetchApp.fetch(API_URL + '/api/v1/observers/observations', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-observer-signature': 'sha256=' + hmac(raw, SECRET) },
      payload: raw,
    });
  }
  t.markRead();
}
```

`GMAIL` untrusted hai — akela confirm nahi karta, Android SMS ke saath milkar confirm karta hai
(30 s window). Detail: `docs/06-api/webhooks.md`.

## 3. Simulator (dev/test)

```bash
npx tsx scripts/observer-simulator.ts health
npx tsx scripts/observer-simulator.ts pay <sessionId>
npx tsx scripts/observer-simulator.ts flow      # order → QR → credit → SUCCESS
```

## Kyun parsing server par hai

- App update kiye bina naye bank formats add kar sakte ho (`sms-parser.ts` + test).
- Trust boundary server par rehti hai: app sirf raw text bhejta hai, amount guess nahi karta.
