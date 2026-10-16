"""Deterministic, offline work-order generator based on keyword rules.

It reads only the text description and the employer's trade choice. It never inspects photos,
and says so in the work order's `image_assessment`.
"""

from __future__ import annotations

import re

from app.schemas.common import Complexity, Trade
from app.schemas.work_order import (
    DurationRange,
    GeneratorInfo,
    ImageAssessment,
    WorkOrderV1,
)
from app.services.work_orders.base import WorkOrderInput
from app.services.work_orders.trade_rules import TRADE_RULES, UNKNOWN_DURATION, ProblemRule

_TRADE_LIST = "plumber, electrician, mason or carpenter"


def normalize_description(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text[:1].upper() + text[1:] if text else text


def _contains(text: str, phrase: str) -> bool:
    return re.search(rf"(?<!\w){re.escape(phrase)}(?!\w)", text) is not None


def _score(text: str, keywords: tuple[str, ...]) -> int:
    return sum(1 for kw in keywords if _contains(text, kw))


def _confidence(top: int, second: int) -> str:
    if top >= 2 and top >= 2 * second:
        return "high"
    if top > second:
        return "medium"
    return "low"


class RuleBasedProvider:
    name = "rule_based"

    def generate(self, data: WorkOrderInput) -> WorkOrderV1:
        normalized = normalize_description(data.description)
        text = normalized.lower()
        scores = {trade: _score(text, rule.keywords) for trade, rule in TRADE_RULES.items()}
        missing: list[str] = []
        questions: list[str] = []

        trade: Trade | None
        if data.trade is not None:
            trade, trade_source, trade_conf = data.trade, "employer_selected", "high"
            other = max((t for t in Trade if t != trade), key=lambda t: scores[t])
            if scores[other] >= 2 and scores[other] > scores[trade]:
                questions.append(
                    f"The description sounds like {other.value} work. "
                    f"Please confirm that a {trade.value} is the right worker."
                )
        else:
            ranked = sorted(Trade, key=lambda t: -scores[t])  # stable: ties keep enum order
            top, second = scores[ranked[0]], scores[ranked[1]]
            if top == 0:
                trade, trade_source, trade_conf = None, "unknown", "low"
            else:
                trade, trade_source = ranked[0], "inferred"
                trade_conf = _confidence(top, second)
                if top == second:
                    questions.append(
                        f"Is this a {ranked[0].value} or a {ranked[1].value} job?"
                    )

        if trade is None:
            missing.append(f"Which trade is needed ({_TRADE_LIST})")
            questions.append(f"Which kind of worker do you need: {_TRADE_LIST}?")
            category = "unclassified"
            summary = "Problem type could not be determined from the description"
            class_conf, complexity = "low", Complexity.medium
            duration, tools, materials = UNKNOWN_DURATION, (), ()
        else:
            rule = TRADE_RULES[trade]
            problem: ProblemRule | None = None
            best = 0
            for candidate in rule.problems:
                s = _score(text, candidate.keywords)
                if s > best:
                    problem, best = candidate, s
            if problem is None:
                problem = rule.default_problem
                class_conf = "low"
                missing.append("The specific problem to be fixed")
                questions.append(f"What exactly needs to be done by the {trade.value}?")
            else:
                class_conf = "high" if best >= 2 else "medium"
            questions.extend(problem.questions)
            category, summary = problem.category, problem.summary
            complexity, duration = problem.complexity, problem.duration
            tools, materials = problem.tools, problem.materials

        if data.image is None:
            image = ImageAssessment(
                status="not_provided",
                disclaimer="No photo was provided.",
            )
        else:
            image = ImageAssessment(
                status="not_analysed",
                disclaimer=(
                    "The photo is stored for the worker to review, but the rule-based generator "
                    "does not inspect images; nothing in this work order is derived from it."
                ),
            )

        return WorkOrderV1(
            normalized_description=normalized,
            suggested_trade=trade,
            trade_source=trade_source,
            trade_confidence=trade_conf,
            problem_category=category,
            problem_summary=summary,
            classification_confidence=class_conf,
            complexity=complexity,
            likely_tools=list(tools),
            likely_materials=list(materials),
            estimated_duration=DurationRange(min_hours=duration[0], max_hours=duration[1]),
            missing_information=missing,
            follow_up_questions=questions,
            image_assessment=image,
            generator=GeneratorInfo(provider="rule_based"),
        )
