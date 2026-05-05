from app.core.config import Settings
from app.schemas import BusinessCandidate, Question
from app.services.compliance import should_call_business


class CallPlannerAgent:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def plan(
        self,
        *,
        businesses: list[BusinessCandidate],
        questions: list[Question],
        selected_business_ids: list[str],
        max_calls: int,
    ) -> tuple[list[BusinessCandidate], list[str]]:
        selected = set(selected_business_ids)
        capped = min(max_calls, self.settings.max_calls_per_task)
        planned: list[BusinessCandidate] = []
        skipped: list[str] = []

        for business in businesses:
            business.selected_for_call = business.id in selected
            if business.id not in selected:
                continue
            allowed, reason = should_call_business(business)
            if not allowed:
                skipped.append(f"{business.name}: {reason}")
                continue
            planned.append(business)
            if len(planned) >= capped:
                break

        if not questions:
            skipped.append("No call questions were provided.")
        return planned, skipped

