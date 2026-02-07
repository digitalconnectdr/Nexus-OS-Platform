from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Numeric, Table, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.core.database import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_deleted = Column(Boolean, default=False)

    # Relationships
    users = relationship("UserProfile", back_populates="organization")
    campaigns = relationship("Campaign", back_populates="organization")
    products = relationship("Product", back_populates="organization")
    sales = relationship("SalesOrder", back_populates="organization")

class UserProfile(Base):
    __tablename__ = "users_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True) # References auth.users(id)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    role = Column(String) # admin, manager, supervisor, agent, qa
    first_name = Column(String)
    last_name = Column(String)
    avatar_url = Column(String)
    email = Column(String) # For identity management display
    is_active = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False) # For permanent removal from lists
    last_seen_at = Column(DateTime(timezone=True))
    skills = Column(JSONB, server_default='[]')
    
    @property
    def full_name(self):
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.first_name or self.email or "USUARIO"

    @property
    def is_super_admin(self) -> bool:
        if not self.role:
            return False
        role = self.role.lower().replace(" ", "_").strip()
        return role in ["super_admin", "superadmin"]

    # Operational Fields (Phase 19)
    supervisor_id = Column(UUID(as_uuid=True), ForeignKey("users_profiles.id"), nullable=True)
    default_campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=True)
    join_date = Column(DateTime(timezone=True))
    vicidial_user = Column(String)
    card_number = Column(String)
    product_skill = Column(String) # Legacy field
    product_skills = Column(JSONB, server_default='[]') # New Multi-Skill field
    custom_max_tasks = Column(Numeric(10, 0), nullable=True) # Capacity Override

    # Relationships
    organization = relationship("Organization", back_populates="users")
    sales = relationship("SalesOrder", foreign_keys="[SalesOrder.agent_id]", back_populates="agent")
    default_campaign = relationship("Campaign")
    supervisor = relationship("UserProfile", remote_side=[id])
    goals = relationship("SalesGoal", back_populates="agent")
    
    # Eager Loading Link for Permissions
    permissions = relationship(
        "RolePermission",
        primaryjoin="UserProfile.role == RolePermission.role",
        foreign_keys="[RolePermission.role]",
        viewonly=True
    )

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    campaign_code = Column(String) # For operational identification
    is_active = Column(Boolean, default=True)
    requires_digitization = Column(Boolean, default=False) # Backoffice optimization
    default_status_id = Column(UUID(as_uuid=True), ForeignKey("statuses.id"), nullable=True)
    is_deleted = Column(Boolean, default=False)

    # Relationships
    organization = relationship("Organization", back_populates="campaigns")
    products = relationship("Product", back_populates="campaign")
    default_status = relationship("Status")

class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"))
    family_name = Column(String, nullable=False)
    name = Column(String, nullable=False)
    plan_name = Column(String) # For 4-level cascade
    current_price = Column(Numeric(10, 2))
    current_pp = Column(Text)
    current_concept = Column(Text)
    incentive = Column(Numeric(10, 2)) # For agents
    is_active = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)
    
    @property
    def campaign_name(self):
        return self.campaign.name if self.campaign else None

    # Relationships
    organization = relationship("Organization", back_populates="products")
    campaign = relationship("Campaign", back_populates="products")
    sales = relationship("SalesOrder", back_populates="product")

class SalesOrder(Base):
    __tablename__ = "sales_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), primary_key=True, server_default=func.now())
    
    agent_id = Column(UUID(as_uuid=True), ForeignKey("users_profiles.id"))
    customer_name = Column(String)
    customer_doc_id = Column(String)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"))
    supervisor_id = Column(UUID(as_uuid=True), ForeignKey("users_profiles.id"), nullable=True)
    
    # Snapshots
    snapshot_family = Column(String)       # Captured Level 1 Family Name
    snapshot_product_name = Column(String) # Captured Level 2 Name
    snapshot_plan = Column(String)         # Captured Level 4 Plan Name
    snapshot_price = Column(Numeric(10, 2))
    snapshot_pp = Column(Text)
    snapshot_concept = Column(Text)
    
    status = Column(String) # Pending, Approved, Installed, Rejected
    
    # New Fields (Phase 12)
    customer_contact = Column(String)
    os_madre = Column(String)
    os_hija = Column(String)
    assigned_to = Column(String)
    comms_claro = Column(String)
    comms_orion = Column(String)
    comms_dofu = Column(String)
    inst_num = Column(String)
    last_updated_by = Column(String)
    modified_fields = Column(JSONB, server_default='[]')
    last_status_change = Column(JSONB)
    is_deleted = Column(Boolean, default=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Backoffice Fields
    digitizer_id = Column(UUID(as_uuid=True), ForeignKey("users_profiles.id"), nullable=True)
    installation_date = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="sales")
    agent = relationship("UserProfile", foreign_keys=[agent_id], back_populates="sales")
    product = relationship("Product", back_populates="sales")
    campaign = relationship("Campaign")
    supervisor = relationship("UserProfile", foreign_keys=[supervisor_id])
    digitizer = relationship("UserProfile", foreign_keys=[digitizer_id])

    @property
    def campaign_name(self):
        return self.campaign.name if self.campaign else None

    @property
    def agent_email(self):
        return self.agent.email if self.agent else None

    @property
    def digitizer_name(self):
        if self.digitizer:
            return f"{self.digitizer.first_name} {self.digitizer.last_name}".strip() or self.digitizer.email
        return self.assigned_to


from .status import Status

class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    role = Column(String, nullable=False) # Enum: Super Admin, Administrador, etc.
    module = Column(String, nullable=False) # Ej: System, SalesTrack, Quality
    resource = Column(String, nullable=False) # Ej: users, campaigns, audits
    action = Column(String, nullable=False) # Ej: read, write, delete
    name = Column(String) # Descriptive label for UI
    is_allowed = Column(Boolean, default=False)

    # Unique constraint per role, module, resource, action, and tenant
    __table_args__ = (
        UniqueConstraint('role', 'module', 'resource', 'action', 'tenant_id', name='_role_module_resource_action_tenant_uc'),
    )

    # Relationship
    organization = relationship("Organization")

class RolePolicy(Base):
    __tablename__ = "role_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    role = Column(String, nullable=False) # Enum: Super Admin, etc.
    smart_routing_enabled = Column(Boolean, default=False)
    default_limit = Column(Numeric(10, 0), default=5)
    workable_statuses = Column(JSONB, server_default='["PENDIENTE"]') # Estatus que restan capacidad

    # Unique constraint per role and tenant
    __table_args__ = (
        UniqueConstraint('role', 'tenant_id', name='_role_tenant_policy_uc'),
    )

    # Relationships
    organization = relationship("Organization")
