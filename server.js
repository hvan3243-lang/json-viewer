const path = require("node:path");
const express = require("express");

const app = express();
const port = Number(process.env.PORT) || 3000;
const publicDir = __dirname;

app.use(express.static(publicDir, { index: "index.html" }));

app.get("/api/proxy", async (req, res) => {
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
      method: "GET",
      headers: {
        Accept: "*/*",
        ...(req.get("authorization")
          ? { Authorization: req.get("authorization") }
          : {})
      },
      signal: controller.signal
    });

    const body = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    const contentType = upstream.headers.get("content-type");
    if (contentType) res.set("content-type", contentType);
    res.set("cache-control", "no-store");
    return res.send(body);
  } catch (error) {
    const causeCode = error.cause && error.cause.code;
    const causeMessage = error.cause && error.cause.message;
    let detail = causeCode || causeMessage || error.message;
    if (error.name === "AbortError") {
      detail = "timeout sau 30 giây";
    }
    const message = `Không thể kết nối API ${targetUrl.hostname}: ${detail}`;
    return res.status(502).json({ message });
  } finally {
    clearTimeout(timeout);
  }
});

app.get("*path", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`JSON Viewer đang chạy tại http://localhost:${port}`);
});
