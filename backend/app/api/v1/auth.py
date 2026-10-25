from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.auth import AuthLoginRequest, UserProfileResponse, UserUpdateRequest
from app.services.auth import (
    authenticate_or_register_user,
    get_user_by_id,
    update_user_profile,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserProfileResponse)
def login_or_register(
    payload: AuthLoginRequest,
    db: Session = Depends(get_db),
) -> UserProfileResponse:
    """Sign in or register using email, phone, or both.

    Returns the persistent unique `user_id`. If the user already exists,
    missing credentials (e.g. adding email to an existing phone account)
    are linked to preserve the exact same ID.
    """
    return authenticate_or_register_user(db, payload)


@router.get("/user/{user_id}", response_model=UserProfileResponse)
def get_profile(
    user_id: str,
    db: Session = Depends(get_db),
) -> UserProfileResponse:
    """Fetch user profile and role by unique user_id."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{user_id}' not found.",
        )
    return UserProfileResponse(
        user_id=user.id,
        phone=user.phone,
        email=user.email,
        name=user.name,
        role=user.role,
        created_at=user.created_at,
        is_new=False,
    )

@router.patch("/user/{user_id}", response_model=UserProfileResponse)
def update_profile(
    user_id: str,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
) -> UserProfileResponse:
    """Update user profile name or email."""
    return update_user_profile(db, user_id, payload)