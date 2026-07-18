// Live-on-Kick check for the nav badge.
//
// Preferred path: Kick's official public API (api.kick.com). To activate it:
//   1. Go to kick.com -> Settings -> Developer and create an app (client credentials)
//   2. In the Vercel project settings, add env vars KICK_CLIENT_ID and KICK_CLIENT_SECRET
// Until those exist, this falls back to Kick's unofficial endpoint, which their
// bot protection usually blocks from datacenter IPs — the badge then just stays hidden.

let cachedToken = null;

async function getOfficialToken() {
    const id = process.env.KICK_CLIENT_ID;
    const secret = process.env.KICK_CLIENT_SECRET;
    if (!id || !secret) return null;
    if (cachedToken && Date.now() < cachedToken.exp - 60000) return cachedToken.token;
    const r = await fetch('https://id.kick.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: id,
            client_secret: secret
        })
    });
    if (!r.ok) return null;
    const d = await r.json();
    cachedToken = { token: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 };
    return cachedToken.token;
}

module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    const dbg = req.query && req.query.debug;
    const reply = (live, viewers, source) => {
        const out = { live, viewers };
        if (dbg) out.source = source;
        res.status(200).json(out);
    };

    // 1) Official API
    try {
        const token = await getOfficialToken();
        if (token) {
            const r = await fetch('https://api.kick.com/public/v1/channels?slug=ryanstrading', {
                headers: { Authorization: 'Bearer ' + token }
            });
            if (r.ok) {
                const d = await r.json();
                const ch = d.data && d.data[0];
                const live = !!(ch && ch.stream && ch.stream.is_live);
                return reply(live, live ? (ch.stream.viewer_count || null) : null, 'official');
            }
        }
    } catch (e) { /* fall through */ }

    // 2) Unofficial fallback (usually 403 from datacenter IPs)
    try {
        const r = await fetch('https://kick.com/api/v2/channels/ryanstrading', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        if (!r.ok) throw new Error('kick ' + r.status);
        const data = await r.json();
        const live = !!(data && data.livestream && data.livestream.is_live);
        return reply(live, live ? (data.livestream.viewer_count || null) : null, 'unofficial');
    } catch (e) {
        return reply(false, null, 'error:' + e.message);
    }
};
