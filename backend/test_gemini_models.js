const { GoogleGenerativeAI } = require("@google/generative-ai");
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
  const genAI = new GoogleGenerativeAI(key);

  try {
    // There isn't a direct listModels in the high level SDK like this, 
    // but we can try a simple generation with a few different names.
    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"];
    
    for (const modelName of modelsToTry) {
      console.log(`\nTesting model: ${modelName}...`);
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hi");
        console.log(`SUCCESS: ${modelName} is available.`);
        console.log("Response:", result.response.text());
      } catch (err) {
        console.error(`FAILED: ${modelName}. Error:`, err.message);
      }
    }
  } catch (err) {
    console.error("General error:", err);
  }
}

main();
