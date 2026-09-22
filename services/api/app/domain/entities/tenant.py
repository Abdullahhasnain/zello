from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class TenantStatus(StrEnum):
    PILOT = "pilot"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CHURNED = "churned"


class StorePhase(StrEnum):
    """Maps 1:1 to the roadmap phases in the SRS's "Phased delivery & IP
    protection" section. Governs which widget bundle and which backend
    capabilities (voice, autonomous checkout) a tenant may use."""

    PHASE_1_TEXT_BETA = "phase_1"
    PHASE_2_VOICE = "phase_2"
    PHASE_3_VOICE_EXPANSION = "phase_3"
    PHASE_4_AUTONOMOUS_COMMERCE = "phase_4"


@dataclass
class Tenant:
    """Framework-agnostic representation of a partner store — the aggregate
    root every other tenant-scoped entity hangs off of. This is what
    services operate on; app/modules/tenants/models.py is only how it's
    persisted."""

    id: UUID
    name: str
    slug: str
    status: TenantStatus
    phase: StorePhase
    branding: dict = field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class FeatureFlag:
    id: UUID
    tenant_id: UUID
    key: str
    enabled: bool
    updated_at: datetime | None = None
