import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
});

export async function summarizeTandC(documentText) {
  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",
    messages: [
      {
        role: "system",
        content: `You are a legal document analyzer. Analyze Terms and Conditions documents and extract key information in a structured JSON format. Always respond with valid JSON only, no markdown, no explanation.`,
      },
      {
        role: "user",
        content: `Analyze this Terms and Conditions document and return a JSON object with exactly these fields:
{
  "summary": "2-3 sentence plain English summary",
  "data_collected": ["list", "of", "data", "types"],
  "duration": "how long data is kept",
  "vendors": ["list", "of", "third", "party", "vendors"],
  "purpose": ["list", "of", "purposes"],
  "risk_level": "Low/Medium/High",
  "key_concerns": ["list", "of", "concerning", "clauses"]
}

Document:
${documentText}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 1000,
  });

  const response = completion.choices[0].message.content;
  return JSON.parse(response);
}

export async function compareVersions(oldText, newText) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are a legal document comparison expert. Compare two versions of Terms and Conditions and identify changes. Always respond with valid JSON only.`,
      },
      {
        role: "user",
        content: `Compare these two versions of Terms and Conditions and return a JSON object:
{
  "added": ["list of new clauses or data points added"],
  "removed": ["list of clauses or data points removed"],
  "modified": ["list of things that changed"],
  "risk_change": "Increased/Decreased/Same",
  "summary": "Plain English explanation of what changed and why it matters"
}

Version 1 (Old):
${oldText}

Version 2 (New):
${newText}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 1000,
  });

  const response = completion.choices[0].message.content;
  return JSON.parse(response);
}