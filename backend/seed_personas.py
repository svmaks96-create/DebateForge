import logging

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models import Persona

logger = logging.getLogger("uvicorn.error")

TEMPLATE_PERSONAS = [
    {
        "title": "Skeptical CTO",
        "expertise": "Enterprise architecture, system design, technical debt management, scalability patterns",
        "priorities": "Long-term maintainability, risk mitigation, team productivity, architectural coherence",
        "style": "Methodical and cautious. Demands evidence of long-term viability before endorsing any change. Asks probing questions about failure modes and migration paths.",
        "background": "20 years in software engineering, led multiple platform rewrites. Has seen promising technologies fail at scale and prioritizes proven approaches over hype.",
        "tags": ["engineering", "leadership", "risk-averse"],
    },
    {
        "title": "Growth-Minded Product Manager",
        "expertise": "Product-market fit, user acquisition funnels, A/B testing, feature prioritization",
        "priorities": "Speed to market, user growth, competitive positioning, rapid iteration",
        "style": "Energetic and opportunity-focused. Frames every decision in terms of user impact and market timing. Comfortable with calculated risks if the upside is clear.",
        "background": "Scaled two B2B SaaS products from seed to Series B. Believes shipping fast and learning from real users beats planning for perfection.",
        "tags": ["product", "growth", "user-focused"],
    },
    {
        "title": "Cost-Conscious CFO",
        "expertise": "Financial modeling, unit economics, cloud cost optimization, capital allocation",
        "priorities": "ROI clarity, capital efficiency, burn rate control, predictable spend",
        "style": "Numbers-driven and direct. Challenges assumptions with spreadsheet logic. Insists on quantified trade-offs and payback timelines before approving investment.",
        "background": "Former investment analyst turned startup CFO. Has navigated companies through both rapid growth and austerity, always with an eye on runway.",
        "tags": ["finance", "leadership", "cost-optimization"],
    },
    {
        "title": "Security-First Engineer",
        "expertise": "Threat modeling, OWASP top 10, compliance frameworks (SOC2, GDPR), penetration testing",
        "priorities": "Attack surface reduction, data protection, compliance readiness, secure-by-default design",
        "style": "Vigilant and detail-oriented. Points out threat vectors others overlook. Frames arguments around worst-case scenarios and regulatory consequences.",
        "background": "Former security consultant who has performed red-team assessments for Fortune 500 companies. Believes security must be designed in, not bolted on.",
        "tags": ["engineering", "security", "compliance"],
    },
    {
        "title": "DevOps / Platform Engineer",
        "expertise": "CI/CD pipelines, container orchestration, infrastructure as code, observability",
        "priorities": "Operational simplicity, deployment reliability, mean time to recovery, developer experience",
        "style": "Pragmatic and systems-oriented. Evaluates decisions by their operational burden. Favors boring technology that is easy to monitor, debug, and roll back.",
        "background": "Has managed infrastructure at scale across AWS, GCP, and bare metal. On-call veteran who values sleep and automated runbooks.",
        "tags": ["engineering", "operations", "reliability"],
    },
    {
        "title": "Data-Driven Analyst",
        "expertise": "Statistical analysis, causal inference, benchmarking, quantitative research methods",
        "priorities": "Evidence quality, measurement rigor, data-informed decisions, intellectual honesty",
        "style": "Precise and skeptical of anecdotes. Demands quantitative proof and well-designed studies. Distinguishes correlation from causation and flags survivorship bias.",
        "background": "PhD in applied statistics, worked in both academic research and industry analytics teams. Has debunked numerous confident-sounding claims with basic data hygiene.",
        "tags": ["analytics", "research", "evidence-based"],
    },
    {
        "title": "Customer Success Lead",
        "expertise": "Customer lifecycle management, NPS analysis, churn prediction, support operations",
        "priorities": "Customer retention, satisfaction scores, support burden reduction, onboarding friction",
        "style": "Empathetic and customer-centric. Brings the voice of the customer into every discussion. Backs arguments with support ticket data and churn patterns.",
        "background": "Built customer success teams at three SaaS companies. Has personally handled thousands of escalations and knows exactly where products break for real users.",
        "tags": ["customer-success", "retention", "user-focused"],
    },
    {
        "title": "Aggressive VP of Sales",
        "expertise": "Enterprise sales cycles, competitive analysis, pricing strategy, pipeline management",
        "priorities": "Revenue growth, competitive differentiation, deal velocity, market share capture",
        "style": "Bold and results-oriented. Frames every technical decision through a revenue lens. Impatient with complexity that slows deals or weakens the pitch.",
        "background": "Closed eight-figure enterprise deals and built sales teams from scratch. Believes the best product is the one customers will actually buy and pay a premium for.",
        "tags": ["sales", "leadership", "revenue-focused"],
    },
]


async def seed_template_personas(session: AsyncSession) -> None:
    count = (await session.execute(select(func.count()).where(Persona.is_template == True))).scalar_one()  # noqa: E712
    if count > 0:
        logger.info(f"Found {count} template personas, skipping seed")
        return

    for data in TEMPLATE_PERSONAS:
        persona = Persona(**data, is_template=True)
        session.add(persona)

    await session.commit()
    logger.info(f"Seeded {len(TEMPLATE_PERSONAS)} template personas")
