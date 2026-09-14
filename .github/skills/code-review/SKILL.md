. Define the Data Models (Pydantic v2)
To ensure strict input validation and structured outputs for the orchestration layer, define the schemas for the review process.

from pydantic import BaseModel, Field
from typing import List, Optional

class CodeReviewRequest(BaseModel):
    code_snippet: str = Field(..., description="The raw source code or diff to be reviewed.")
    language: str = Field(default="python", description="Programming language of the snippet.")
    context: Optional[str] = Field(None, description="PR description, ticket context, or specific architecture requirements.")

class ReviewIssue(BaseModel):
    line_number: Optional[int] = Field(None, description="Line number of the issue, if applicable.")
    severity: str = Field(..., description="CRITICAL, WARNING, or INFO")
    description: str = Field(..., description="Explanation of the vulnerability, bug, or style issue.")
    suggested_fix: str = Field(..., description="Actionable code snippet to resolve the issue.")

class CodeReviewResponse(BaseModel):
    approved: bool = Field(..., description="Boolean indicating if the code passes quality gates.")
    issues: List[ReviewIssue] = Field(default_factory=list, description="List of identified issues.")
    summary: str = Field(..., description="Brief executive summary of the review.")
