const axios = require("axios");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

async function main() {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) {
    console.error("GOOGLE_API_KEY not found in .env");
    return;
  }

  console.log("Using API Key starting with:", key.substring(0, 10));

  const versions = ["v1beta", "v1"];

  for (const v of versions) {
    console.log(`\n--- Testing API Version: ${v} ---`);
    try {
      const url = `https://generativelanguage.googleapis.com/${v}/models?key=${key}`;
      const response = await axios.get(url);
      console.log(`SUCCESS: Found ${response.data.models.length} models.`);
      const names = response.data.models.map(m => m.name);
      console.log("Available model names:", names.slice(0, 10).join(", "), names.length > 10 ? "..." : "");
      
      // If we find models, let's try a generateContent on the first one
      if (names.length > 0) {
        const testModel = names.find(n => n.includes("flash")) || names[0];
        console.log(`Testing generateContent on: ${testModel}`);
        const genUrl = `https://generativelanguage.googleapis.com/${v}/${testModel}:generateContent?key=${key}`;
        const genResp = await axios.post(genUrl, {
          contents: [{ parts: [{ text: "Hi" }] }]
        });
        console.log("Response success!");
      }
    } catch (err) {
      console.error(`FAILED: ${v}. Status:`, err.response?.status);
      console.error("Error body:", JSON.stringify(err.response?.data, null, 2));
    }
  }
}

main();
