"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")

    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.Text, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "accounts",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("balance", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("is_primary", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("balance >= 0", name="accounts_positive_balance"),
        sa.UniqueConstraint("user_id", "currency", name="uq_accounts_user_currency"),
    )
    op.create_index("ix_accounts_user_id", "accounts", ["user_id"])

    op.execute("CREATE TYPE transfer_status AS ENUM ('pending','processing','completed','failed','cancelled')")

    op.create_table(
        "transfers",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("reference", sa.String(20), nullable=False, unique=True),
        sa.Column("sender_id", UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("recipient_name", sa.String(255), nullable=False),
        sa.Column("recipient_email", sa.String(255), nullable=True),
        sa.Column("source_currency", sa.String(3), nullable=False),
        sa.Column("target_currency", sa.String(3), nullable=False),
        sa.Column("source_amount", sa.Numeric(18, 4), nullable=False),
        sa.Column("target_amount", sa.Numeric(18, 4), nullable=False),
        sa.Column("exchange_rate", sa.Numeric(18, 6), nullable=False),
        sa.Column("fee_amount", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("status", sa.Enum("pending", "processing", "completed", "failed", "cancelled", name="transfer_status"), nullable=False, server_default="pending"),
        sa.Column("celery_task_id", sa.String(255), nullable=True),
        sa.Column("failure_reason", sa.Text, nullable=True),
        sa.Column("estimated_arrival", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_transfers_sender_id", "transfers", ["sender_id"])
    op.create_index("ix_transfers_reference", "transfers", ["reference"])
    op.create_index("ix_transfers_status", "transfers", ["status"])
    op.create_index("ix_transfers_created_at", "transfers", ["created_at"])

    op.create_table(
        "rate_snapshots",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("base", sa.String(3), nullable=False),
        sa.Column("target", sa.String(3), nullable=False),
        sa.Column("rate", sa.Numeric(18, 6), nullable=False),
        sa.Column("source", sa.String(50), nullable=False, server_default="frankfurter"),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_rate_snapshots_base_target", "rate_snapshots", ["base", "target"])
    op.create_index("ix_rate_snapshots_fetched_at", "rate_snapshots", ["fetched_at"])


def downgrade() -> None:
    op.drop_table("rate_snapshots")
    op.drop_table("transfers")
    op.execute("DROP TYPE transfer_status")
    op.drop_table("accounts")
    op.drop_table("users")
