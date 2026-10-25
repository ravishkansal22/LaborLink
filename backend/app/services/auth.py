from __future__ import annotations

from sqlalchemy.orm import Session
from app.errors import AppError, ConflictError, NotFoundError
from app.models import User
from app.schemas.auth import AuthLoginRequest, UserProfileResponse, UserUpdateRequest


class BadRequestError(AppError):
    status_code = 400
    code = "bad_request"


def authenticate_or_register_user(db: Session, payload: AuthLoginRequest) -> UserProfileResponse:
    phone = payload.phone
    email = payload.email

    if not phone and not email:
        raise BadRequestError("Either a valid phone number or email must be provided.")

    user: User | None = None

    # 1. Lookup by phone
    if phone:
        user = db.query(User).filter(User.phone == phone).first()

    # 2. Lookup by email
    if not user and email:
        user = db.query(User).filter(User.email == email).first()

    # Handle explicit 'login' mode: User MUST exist
    if payload.mode == "login":
        if not user:
            identifier = phone or email
            raise NotFoundError(f"No account found for '{identifier}'. Please sign up first.")

    # Handle explicit 'register' mode: User MUST NOT already exist
    if payload.mode == "register":
        if user:
            raise ConflictError("An account with this phone or email already exists. Please log in.")

    is_new = False

    if user:
        # Existing user: link any missing fields
        updated = False
        if email and not user.email:
            user.email = email
            updated = True
        if phone and not user.phone:
            user.phone = phone
            updated = True
        if payload.name and not user.name:
            user.name = payload.name.strip()
            updated = True
        if updated:
            db.commit()
            db.refresh(user)
    else:
        # Create new user
        is_new = True
        user = User(
            phone=phone,
            email=email,
            name=payload.name.strip() if payload.name else None,
            role=payload.role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return UserProfileResponse(
        user_id=user.id,
        phone=user.phone,
        email=user.email,
        name=user.name,
        role=user.role,
        created_at=user.created_at,
        is_new=is_new,
    )


def get_user_by_id(db: Session, user_id: str) -> User | None:
    return db.query(User).filter(User.id == user_id).first()

def update_user_profile(
    db: Session,
    user_id: str,
    payload: UserUpdateRequest,
) -> UserProfileResponse:
    user = get_user_by_id(db, user_id)
    if not user:
        raise NotFoundError(f"User '{user_id}' not found.")

    if payload.name is not None:
        user.name = payload.name.strip()

    if payload.email is not None:
        cleaned_email = payload.email.strip().lower()
        # Check if another user already has this email
        existing = db.query(User).filter(User.email == cleaned_email, User.id != user_id).first()
        if existing:
            raise ConflictError("This email address is already in use by another account.")
        user.email = cleaned_email

    db.commit()
    db.refresh(user)

    return UserProfileResponse(
        user_id=user.id,
        phone=user.phone,
        email=user.email,
        name=user.name,
        role=user.role,
        created_at=user.created_at,
        is_new=False,
    )