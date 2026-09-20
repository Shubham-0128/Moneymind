import os
import json
import logging
from typing import Any, Dict, List
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from backend.models import User
from backend.security import get_current_user

logger = logging.getLogger("moneymind.ai")
router = APIRouter(prefix="/api/ai", tags=["AI Budget Coaching"])

class AISuggestionsRequest(BaseModel):
    summary: Dict[str, Any]

class AISuggestionsResponse(BaseModel):
    suggestions: List[str]

def generate_local_fallback_suggestions(summary: Dict[str, Any]) -> List[str]:
    # Smart algorithmic suggestions when Anthropic API key is not configured
    suggestions = []
    month_total = summary.get("monthTotal", summary.get("total_amount", summary.get("currentMonthTotal", 0)))
    cat_breakdown = summary.get("categoryBreakdown", summary.get("spendingByCategory", {}))

    if isinstance(cat_breakdown, dict) and cat_breakdown:
        highest_cat = max(cat_breakdown.items(), key=lambda x: x[1])
        cat_name, cat_val = highest_cat
        suggestions.append(
            f"Your highest spending category is {cat_name} (₹{cat_val:,.2f}). "
            f"Review these transactions to identify where you can trim ~10-15% this month."
        )

    if month_total > 50000:
        suggestions.append(
            f"Total monthly spend is ₹{month_total:,.2f}. Consider setting a strict weekly spending cap "
            f"of ₹{round(month_total / 4):,} to maintain positive cashflow."
        )
    else:
        suggestions.append(
            "Track your daily micro-expenses (coffee, quick snacks, cabs). "
            "They typically account for up to 18% of monthly budget leakage."
        )

    suggestions.append(
        "Automate transfers to your savings goals right on payday before discretionary spending begins."
    )
    return suggestions[:3]

@router.post("/suggestions", response_model=AISuggestionsResponse)
async def get_suggestions(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    summary = payload.get("summary", payload)

    if not api_key or api_key == "your_anthropic_api_key_here" or api_key == "your_key_here":
        return AISuggestionsResponse(suggestions=generate_local_fallback_suggestions(summary))

    prompt = f"""You are an expert personal finance coach analyzing a user's expense data.

Here is the compact aggregated spending summary:
{json.dumps(summary, indent=2)}

Provide 2 to 3 concise, specific, and actionable budgeting tips or observations based on these exact figures.

CRITICAL INSTRUCTIONS:
1. Reference specific categories and amounts (in ₹).
2. For any standout or high spending category, recommend a concrete, practical action they can take this week.
3. NEVER return vague advice like "try to save more money" or "cut unnecessary expenses".
4. Return ONLY a valid JSON array of 2 to 3 short strings, with no markdown code blocks, explanations, or wrapping.
"""

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01"
                },
                json={
                    "model": "claude-sonnet-4-6",
                    "max_tokens": 500,
                    "messages": [{"role": "user", "content": prompt}]
                }
            )

        if res.status_code != 200:
            logger.warning(f"Anthropic API returned status {res.status_code}: {res.text}. Using smart fallback.")
            return AISuggestionsResponse(suggestions=generate_local_fallback_suggestions(summary))

        data = res.json()
        raw_text = data.get("content", [{}])[0].get("text", "").strip()

        # Clean markdown code blocks if model returned them
        if raw_text.startswith("```json"):
            raw_text = raw_text.removeprefix("```json").removesuffix("```").strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text.removeprefix("```").removesuffix("```").strip()

        suggestions = json.loads(raw_text)
        if not isinstance(suggestions, list):
            return AISuggestionsResponse(suggestions=generate_local_fallback_suggestions(summary))
        return AISuggestionsResponse(suggestions=suggestions)

    except Exception as e:
        logger.error(f"Error calling AI suggestions: {e}")
        return AISuggestionsResponse(suggestions=generate_local_fallback_suggestions(summary))
