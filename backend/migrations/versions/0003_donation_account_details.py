"""Add admin-managed bank account and UPI details for donations.

Revision ID: 0003_donation_account
Revises: 0002_section_layouts
"""
import sqlalchemy as sa
from alembic import op

revision = "0003_donation_account"
down_revision = "0002_section_layouts"
branch_labels = None
depends_on = None

# Official details supplied by the organisation; applied to an existing footer row so the
# Donate page shows them straight away. They are editable afterwards in Admin > Footer.
COLUMNS = {
    "bank_holder_name": (120, "VGLUG Foundation"),
    "bank_account_number": (40, "1208135000013738"),
    "bank_ifsc": (20, "KVBL0001208"),
    "bank_name": (120, "Karur Vysya Bank"),
    "bank_branch": (120, "Villupuram"),
    "upi_id": (120, "mswstatic.1450060426309930@kvbupi"),
}


def upgrade():
    with op.batch_alter_table("footer_settings") as batch:
        for name, (length, _) in COLUMNS.items():
            batch.add_column(sa.Column(name, sa.String(length=length), nullable=False, server_default=""))
    table = sa.table("footer_settings", *(sa.column(name, sa.String) for name in COLUMNS))
    op.execute(table.update().values({name: value for name, (_, value) in COLUMNS.items()}))


def downgrade():
    with op.batch_alter_table("footer_settings") as batch:
        for name in COLUMNS:
            batch.drop_column(name)
