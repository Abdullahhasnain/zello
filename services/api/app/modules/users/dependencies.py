from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.modules.users.repository import (
    SqlAlchemyAdminUserRepository,
    SqlAlchemyStoreUserRepository,
)
from app.modules.users.service import UserService


def get_user_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> UserService:
    return UserService(
        store_user_repository=SqlAlchemyStoreUserRepository(session),
        admin_user_repository=SqlAlchemyAdminUserRepository(session),
    )
