// Proxies Kick's channel API (no CORS headers on their end) so the
// front-end can show a LIVE badge when Ryan is streaming.
module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
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
        res.status(200).json({
            live,
            viewers: live ? (data.livestream.viewer_count || null) : null
        });
    } catch (e) {
        res.status(200).json({ live: false });
    }
};
