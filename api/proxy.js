const { gunzipSync } = require("node:zlib");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Chỉ hỗ trợ phương thức GET." });
  }

  const target = typeof req.query.url === "string" ? req.query.url : "";
  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return res.status(400).json({ message: "URL API không hợp lệ." });
  }

  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    return res.status(400).json({ message: "API chỉ hỗ trợ HTTP hoặc HTTPS." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        Accept: "*/*",
        ...(req.headers.authorization
          ? { Authorization: req.headers.authorization }
          : {})
      },
      signal: controller.signal
    });

    const body = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("content-type", contentType);
    res.setHeader("cache-control", "no-store");
    return res.send(body);
  } catch (error) {
    const causeCode = error.cause && error.cause.code;
    const detail = error.name === "AbortError"
      ? "timeout sau 30 giây"
      : causeCode || error.message;
    return res.status(502).json({
      message: `Không thể kết nối API ${targetUrl.hostname}: ${detail}`
    });
  } finally {
    clearTimeout(timeout);
  }
};
