const express = require("express");
const app = express();
const path = require("path");

const PORT = process.env.PORT || 6069; // Use Render-assigned port in production

// Example route
app.get("/", (req, res) => {
  res.send("🟢 FB Bot is Running Successfully on Render!");
});

app.listen(PORT, () => {
  console.log(`✅ Server started on http://localhost:${PORT}`);
});
