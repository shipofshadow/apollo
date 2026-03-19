const express = require("express");

const app = express();

const ACCESS_TOKEN = "EAAhserHk7D0BQ9Q4ez6izUkHkYs8E3E9ZAwf9m7yBZAHXAiiyTp5S0HaFIQZBaK9U6V0bRm5Aqo9Mru2J6GCD1EczZCC9oZAFGF6AHhfLmVyjBxsV2CgcRK2P0fL3e5yrQq7d9uFiZAn0sPFtZCrPYebfUELCVZCQW2qeL7KuHCYgZBdyM2mR9ZCpEH3IvfZCJABzDCSUvAxJT9r3owTh3WxL9FlKRssxVTdHphMGzVwPpDaEIwYEalkKoCqtnJtP0ZD";

app.get("/", async (req, res) => {
  try {
    const url = `https://graph.facebook.com/v25.0/me/posts?fields=id,message,created_time,full_picture,attachments{description,media,url,subattachments},likes.summary(true).limit(0),comments.summary(true).limit(0),shares&access_token=${ACCESS_TOKEN}`;

    const fbRes = await fetch(url);
    const data = await fbRes.json();

    if (!fbRes.ok) {
      console.error("Facebook API Error:", data.error);
      return res.status(500).send(`API Error: ${data.error.message}`);
    }

    const posts = data.data || [];

    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Facebook Feed</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
          body { background-color: #f8f9fa; }
          .fb-card {
            transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
            text-decoration: none;
            color: inherit;
            display: block;
          }
          .fb-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important;
          }
        </style>
      </head>
      <body>
        <div class="container py-5" style="max-width: 650px;">
          <h2 class="mb-4 text-center fw-bold">Recent Updates</h2>
    `;

    posts.forEach(post => {
      // Prevent XSS
      const safeMessage = (post.message || "No caption")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      const readableDate = new Date(post.created_time).toLocaleString();

      const likesCount = post.likes?.summary?.total_count || 0;
      const commentsCount = post.comments?.summary?.total_count || 0;
      const sharesCount = post.shares?.count || 0;

      // Handle Album/Carousel vs Single Image
      let imagesHtml = "";
      const subattachments = post.attachments?.data?.[0]?.subattachments?.data;

      if (subattachments && subattachments.length > 0) {
        subattachments.forEach(sub => {
          const imgSrc = sub.media?.image?.src;
          if (imgSrc) {
            imagesHtml += `<img src="${imgSrc}" class="img-fluid rounded mb-2 w-100" alt="Post image" />`;
          }
        });
      } else {
        const singleImage = post.full_picture || post.attachments?.data?.[0]?.media?.image?.src || null;
        if (singleImage) {
          imagesHtml = `<img src="${singleImage}" class="img-fluid rounded mb-2 w-100" alt="Post image" />`;
        }
      }

      // FIX 1: Removed the backslashes that broke Node
      // FIX 2: Split the Graph ID to build a bulletproof Facebook URL
      const idParts = post.id.split("_");
      const postUrl = idParts.length === 2 
        ? `https://www.facebook.com/${idParts[0]}/posts/${idParts[1]}` 
        : `https://www.facebook.com/${post.id}`;

      html += `
        <a href="${postUrl}" target="_blank" rel="noopener noreferrer" class="card shadow-sm mb-4 fb-card border-0 rounded-4">
          <div class="card-body p-4">
            <p class="card-text fs-5" style="white-space: pre-wrap;">${safeMessage}</p>
            
            ${imagesHtml}
            
            <hr class="text-muted">
            
            <div class="d-flex justify-content-between text-secondary fw-semibold mb-2">
              <span><i class="bi bi-hand-thumbs-up"></i> 👍 ${likesCount}</span>
              <span>💬 ${commentsCount}</span>
              <span>🔄 ${sharesCount}</span>
            </div>

            <small class="text-muted d-block text-end">${readableDate}</small>
          </div>
        </a>
      `;
    });

    html += `
        </div>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).send("Error fetching posts from Facebook.");
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});