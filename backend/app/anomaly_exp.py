import os
import json
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

_llm = ChatGoogleGenerativeAI(
    model=os.getenv("MODEL_NAME", "gemini-2.5-flash"),
    api_key=os.getenv("API_KEY", "")
)


SYSTEM_PROMPT = """
You are an invoice risk explanation engine.

Your task:
- Generate ONE short explanation sentence.
- Use ONLY the provided context.
- Do NOT invent facts.
- Do NOT mention missing fields.
- Keep response under 35 words.
- Sound like an audit assistant, not a chatbot.

Examples:
Input:
{
  "validation_error": ["GST number missing"],
  "warnings": [],
  "is_duplicate": false
}

Output:
"Flagged because the invoice is missing a GST number."

Input:
{
  "match_result": {
      "vendor_new": true,
      "amount_deviation_percent": 62
  },
  "warnings": ["High amount variance"],
  "is_duplicate": false
}

Output:
"Flagged because the vendor is new and the invoice amount is significantly higher than similar invoices."
"""


def explanation(context: dict, max_retries: int = 3) -> str:
    """
    Generate a short plain-English explanation
    from structured invoice risk signals.
    """

    payload = json.dumps(context, indent=2)

    for attempt in range(1, max_retries + 1):
        try:
            messages = [
                ("system", SYSTEM_PROMPT),
                (
                    "human",
                    f"Generate explanation from this context:\n\n{payload}"
                )
            ]

            response = _llm.invoke(messages)

            text = response.content.strip()

            # tiny cleanup guard
            text = text.replace("\n", " ")

            if len(text) > 250:
                text = text[:250]

            return text

        except Exception as e:
            if attempt == max_retries:
                return "Flagged due to multiple risk indicators."

    return "Flagged due to multiple risk indicators."

if __name__ == '__main__':
    context = {
        "validation": {
            "errors": [
                "GST number missing"
            ],
        },

        "matching": {
            "is_duplicate": False,
            "vendor_new": True,
            "po_match_confidence": 0.42,
            "amount_deviation_percent": 61
        },

        "risk": {
            "score": 0.87,
            "level": "high"
        },

        "pipeline_warnings": [
            "High amount variance compared to category baseline"
        ]
    }
    print(explanation(context))