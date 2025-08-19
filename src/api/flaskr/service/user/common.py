# common user


import random
import string
import uuid
from flaskr.common.config import get_config
from flask import Flask

import jwt

from flaskr.service.order.consts import LEARN_STATUS_RESET
from flaskr.service.user.models import User
from sqlalchemy import text
from flaskr.api.sms.aliyun import send_sms_code_ali
from flaskr.service.study.models import LearnProgressRecord
from ..common.dtos import (
    USER_STATE_REGISTERED,
    USER_STATE_UNREGISTERED,
    UserInfo,
    UserToken,
)
from ..common.models import raise_error
from .utils import generate_token, get_user_language, get_user_openid
from ...dao import redis_client as redis, db
from flaskr.service.shifu.models import PublishedShifu
from flaskr.i18n import get_i18n_list

FIX_CHECK_CODE = get_config("UNIVERSAL_VERIFICATION_CODE") or None


def validate_user(app: Flask, token: str) -> UserInfo:
    with app.app_context():
        if not token:
            raise_error("USER.USER_NOT_LOGIN")
        try:
            if app.config.get("ENVERIMENT", "prod") == "dev":
                user_id = token
                user = User.query.filter_by(user_id=user_id).first()

                if user:
                    return UserInfo(
                        user_id=user.user_id,
                        username=user.username,
                        name=user.name,
                        email=user.email,
                        mobile=user.mobile,
                        user_state=user.user_state,
                        wx_openid=get_user_openid(user),
                        language=get_user_language(user),
                        user_avatar=user.user_avatar,
                        is_admin=user.is_admin,
                        is_creator=user.is_creator,
                    )
            else:
                user_id = jwt.decode(
                    token, app.config["SECRET_KEY"], algorithms=["HS256"]
                )["user_id"]
                app.logger.info("user_id:" + user_id)

            app.logger.info("user_id:" + user_id)
            redis_user_id = redis.get(app.config["REDIS_KEY_PREFIX_USER"] + token)
            if redis_user_id is None:
                raise_error("USER.USER_TOKEN_EXPIRED")
            set_user_id = str(
                redis_user_id,
                encoding="utf-8",
            )
            if set_user_id == user_id:
                user = User.query.filter_by(user_id=user_id).first()
                if user:
                    return UserInfo(
                        user_id=user.user_id,
                        username=user.username,
                        name=user.name,
                        email=user.email,
                        mobile=user.mobile,
                        user_state=user.user_state,
                        wx_openid=get_user_openid(user),
                        language=get_user_language(user),
                        user_avatar=user.user_avatar,
                        is_admin=user.is_admin,
                        is_creator=user.is_creator,
                    )
                else:
                    raise_error("USER.USER_TOKEN_EXPIRED")
            else:
                raise_error("USER.USER_TOKEN_EXPIRED")
        except jwt.exceptions.ExpiredSignatureError:
            raise_error("USER.USER_TOKEN_EXPIRED")
        except jwt.exceptions.DecodeError:
            raise_error("USER.USER_NOT_FOUND")


def update_user_info(
    app: Flask, user: UserInfo, name, email=None, mobile=None, language=None
) -> UserInfo:
    with app.app_context():
        if user:
            app.logger.info(
                "update_user_info {} {} {} {}".format(name, email, mobile, language)
            )
            dbuser = User.query.filter_by(user_id=user.user_id).first()
            dbuser.name = name
            if email is not None:
                dbuser.email = email
            if mobile is not None:
                dbuser.mobile = mobile
            if language is not None:
                if language in get_i18n_list(app):
                    dbuser.user_language = language
                else:
                    raise_error("USER.LANGUAGE_NOT_FOUND")
            db.session.commit()
            return UserInfo(
                user_id=user.user_id,
                username=user.username,
                name=user.name,
                email=user.email,
                mobile=user.mobile,
                user_state=dbuser.user_state,
                wx_openid=get_user_openid(user),
                language=dbuser.user_language,
                user_avatar=dbuser.user_avatar,
                is_admin=dbuser.is_admin,
                is_creator=dbuser.is_creator,
            )
        else:
            raise_error("USER.USER_NOT_FOUND")


def get_user_info(app: Flask, user_id: str) -> UserInfo:
    with app.app_context():
        user = User.query.filter_by(user_id=user_id).first()
        if user:
            return UserInfo(
                user_id=user.user_id,
                username=user.username,
                name=user.name,
                email=user.email,
                mobile=user.mobile,
                user_state=user.user_state,
                wx_openid=get_user_openid(user),
                language=get_user_language(user),
                user_avatar=user.user_avatar,
                is_admin=user.is_admin,
                is_creator=user.is_creator,
            )
        else:
            raise_error("USER.USER_NOT_FOUND")


def get_sms_code_info(app: Flask, user_id: str, resend: bool):
    with app.app_context():
        phone = redis.get(app.config["REDIS_KEY_PREFIX_PHONE"] + user_id)
        if phone is None:
            user = User.query.filter(User.user_id == user_id).first()
            phone = user.mobile
        else:
            phone = str(phone, encoding="utf-8")
        ttl = redis.ttl(app.config["REDIS_KEY_PREFIX_PHONE_CODE"] + phone)
        if ttl < 0:
            ttl = 0
        return {"expire_in": ttl, "phone": phone}


def send_sms_code_without_check(app: Flask, user_info: User, phone: str):
    user_info.mobile = phone
    characters = string.digits
    random_string = "".join(random.choices(characters, k=4))
    # 发送短信验证码
    redis.set(
        app.config["REDIS_KEY_PREFIX_PHONE"] + user_info.user_id,
        phone,
        ex=app.config.get("PHONE_EXPIRE_TIME", 60 * 30),
    )
    redis.set(
        app.config["REDIS_KEY_PREFIX_PHONE_CODE"] + phone,
        random_string,
        ex=app.config["PHONE_CODE_EXPIRE_TIME"],
    )
    send_sms_code_ali(app, phone, random_string)
    db.session.flush()
    return {"expire_in": app.config["PHONE_CODE_EXPIRE_TIME"], "phone": phone}


def verify_sms_code_without_phone(
    app: Flask, user_info: User, checkcode, course_id: str = None
) -> UserToken:
    with app.app_context():
        phone = redis.get(app.config["REDIS_KEY_PREFIX_PHONE"] + user_info.user_id)
        if phone is None:
            app.logger.info("cache user_id:" + user_info.user_id + " phone is None")
            user = (
                User.query.filter(User.user_id == user_info.user_id)
                .order_by(User.id.asc())
                .first()
            )
            phone = user.mobile
        else:
            phone = str(phone, encoding="utf-8")
            user = (
                User.query.filter(User.mobile == phone).order_by(User.id.asc()).first()
            )
            if user:
                user_id = user.user_id
        ret = verify_sms_code(app, user_id, phone, checkcode, course_id)
        db.session.commit()
        return ret


def migrate_user_study_record(
    app: Flask, from_user_id: str, to_user_id: str, course_id: str = None
):
    app.logger.info(
        "migrate_user_study_record from_user_id:"
        + from_user_id
        + " to_user_id:"
        + to_user_id
    )
    from_attends = LearnProgressRecord.query.filter(
        LearnProgressRecord.user_bid == from_user_id,
        LearnProgressRecord.status != LEARN_STATUS_RESET,
        LearnProgressRecord.shifu_bid == course_id,
    ).all()
    to_attends = LearnProgressRecord.query.filter(
        LearnProgressRecord.user_bid == to_user_id,
        LearnProgressRecord.status != LEARN_STATUS_RESET,
        LearnProgressRecord.shifu_bid == course_id,
    ).all()
    migrate_attends = []
    for from_attend in from_attends:
        to_attend = [
            to_attend
            for to_attend in to_attends
            if to_attend.outline_item_bid == from_attend.outline_item_bid
        ]
        if len(to_attend) > 0:
            continue
        else:
            migrate_attends.append(from_attend)
    if len(migrate_attends) > 0:
        db.session.execute(
            text(
                "update learn_progress_records set user_bid = '%s' where id in (%s)"
                % (to_user_id, ",".join([str(attend.id) for attend in migrate_attends]))
            )
        )
        db.session.execute(
            text(
                "update learn_generated_blocks set user_bid = '%s' where progress_record_bid in (%s)"
                % (
                    to_user_id,
                    ",".join(
                        [
                            "'" + str(attend.progress_record_bid) + "'"
                            for attend in migrate_attends
                        ]
                    ),
                )
            )
        )

        db.session.flush()


# verify sms code
def verify_sms_code(
    app: Flask,
    user_id,
    phone: str,
    chekcode: str,
    course_id: str = None,
    language: str = None,
) -> UserToken:
    from flaskr.service.profile.funcs import (
        get_user_profile_labels,
        update_user_profile_with_lable,
    )

    check_save = redis.get(app.config["REDIS_KEY_PREFIX_PHONE_CODE"] + phone)
    if check_save is None and (FIX_CHECK_CODE is None or chekcode != FIX_CHECK_CODE):
        raise_error("USER.SMS_SEND_EXPIRED")
    check_save_str = str(check_save, encoding="utf-8") if check_save else ""
    if chekcode != check_save_str and (FIX_CHECK_CODE is None or chekcode != FIX_CHECK_CODE):
        raise_error("USER.SMS_CHECK_ERROR")
    else:
        redis.delete(app.config["REDIS_KEY_PREFIX_PHONE_CODE"] + phone)
        user_info = (
            User.query.filter(User.mobile == phone)
            .order_by(User.user_state.desc())
            .order_by(User.id.asc())
            .first()
        )
        if not user_info:
            user_info = (
                User.query.filter(User.user_id == user_id)
                .order_by(User.id.asc())
                .first()
            )
        elif user_id != user_info.user_id and course_id is not None:
            new_profiles = get_user_profile_labels(app, user_id, course_id)
            update_user_profile_with_lable(
                app, user_info.user_id, new_profiles, course_id
            )
            origin_user = User.query.filter(User.user_id == user_id).first()
            migrate_user_study_record(
                app, origin_user.user_id, user_info.user_id, course_id
            )
            if (
                origin_user
                and origin_user.user_open_id != user_info.user_open_id  # noqa W503
                and (
                    user_info.user_open_id is None  # noqa W503
                    or user_info.user_open_id == ""
                )
            ):
                user_info.user_open_id = origin_user.user_open_id
        if user_info is None:
            user_id = str(uuid.uuid4()).replace("-", "")
            user_info = User(
                user_id=user_id, username="", name="", email="", mobile=phone
            )
            if (
                user_info.user_state is None
                or user_info.user_state == USER_STATE_UNREGISTERED  # noqa W503
            ):
                user_info.user_state = USER_STATE_REGISTERED
            user_info.mobile = phone
            user_info.user_language = language
            db.session.add(user_info)
            # New user registration requires course association detection
            # When there is an install ui, the logic here should be removed
            init_first_course(app, user_info.user_id)

        if user_info.user_state == USER_STATE_UNREGISTERED:
            user_info.mobile = phone
            user_info.user_state = USER_STATE_REGISTERED
            user_info.user_language = language
        user_id = user_info.user_id
        token = generate_token(app, user_id=user_id)
        db.session.flush()
        return UserToken(
            UserInfo(
                user_id=user_info.user_id,
                username=user_info.username,
                name=user_info.name,
                email=user_info.email,
                mobile=user_info.mobile,
                user_state=user_info.user_state,
                wx_openid=get_user_openid(user_info),
                language=get_user_language(user_info),
                user_avatar=user_info.user_avatar,
                is_admin=user_info.is_admin,
                is_creator=user_info.is_creator,
            ),
            token,
        )


# verify mail code
def verify_mail_code(
    app: Flask,
    user_id,
    mail: str,
    chekcode: str,
    course_id: str = None,
    language: str = None,
) -> UserToken:
    from flaskr.service.profile.funcs import (
        get_user_profile_labels,
        update_user_profile_with_lable,
    )

    check_save = redis.get(app.config["REDIS_KEY_PREFIX_MAIL_CODE"] + mail)
    if check_save is None and (FIX_CHECK_CODE is None or chekcode != FIX_CHECK_CODE):
        raise_error("USER.MAIL_SEND_EXPIRED")
    check_save_str = str(check_save, encoding="utf-8") if check_save else ""
    if chekcode != check_save_str and (FIX_CHECK_CODE is None or chekcode != FIX_CHECK_CODE):
        raise_error("USER.MAIL_CHECK_ERROR")
    else:
        redis.delete(app.config["REDIS_KEY_PREFIX_MAIL_CODE"] + mail)
        user_info = (
            User.query.filter(User.email == mail)
            .order_by(User.user_state.desc())
            .order_by(User.id.asc())
            .first()
        )
        if not user_info:
            user_info = (
                User.query.filter(User.user_id == user_id)
                .order_by(User.id.asc())
                .first()
            )
        elif user_id != user_info.user_id and course_id is not None:
            new_profiles = get_user_profile_labels(app, user_id, course_id)
            update_user_profile_with_lable(
                app, user_info.user_id, new_profiles, course_id
            )
            origin_user = User.query.filter(User.user_id == user_id).first()
            migrate_user_study_record(
                app, origin_user.user_id, user_info.user_id, course_id
            )
            if (
                origin_user
                and origin_user.user_open_id != user_info.user_open_id  # noqa W503
                and (
                    user_info.user_open_id is None  # noqa W503
                    or user_info.user_open_id == ""
                )
            ):
                user_info.user_open_id = origin_user.user_open_id
        if user_info is None:
            user_id = str(uuid.uuid4()).replace("-", "")
            user_info = User(
                user_id=user_id, username="", name="", email=mail, mobile=""
            )
            if (
                user_info.user_state is None
                or user_info.user_state == USER_STATE_UNREGISTERED  # noqa W503
            ):
                user_info.user_state = USER_STATE_REGISTERED
            user_info.email = mail
            user_info.user_language = language
            db.session.add(user_info)
            # New user registration requires course association detection
            # When there is an install ui, the logic here should be removed
            init_first_course(app, user_info.user_id)

        if user_info.user_state == USER_STATE_UNREGISTERED:
            user_info.email = mail
            user_info.user_state = USER_STATE_REGISTERED
            user_info.user_language = language
        user_id = user_info.user_id
        token = generate_token(app, user_id=user_id)
        db.session.flush()
        return UserToken(
            UserInfo(
                user_id=user_info.user_id,
                username=user_info.username,
                name=user_info.name,
                email=user_info.email,
                mobile=user_info.mobile,
                user_state=user_info.user_state,
                wx_openid=get_user_openid(user_info),
                language=get_user_language(user_info),
                user_avatar=user_info.user_avatar,
                is_admin=user_info.is_admin,
                is_creator=user_info.is_creator,
            ),
            token,
        )


def init_first_course(app: Flask, user_id: str):
    """
    Check if there is only one user and one course. If so, update the creator of the course
    and set the first user as admin and creator
    """
    # Check the number of users
    user_count = User.query.filter(User.user_state != USER_STATE_UNREGISTERED).count()
    if user_count != 1:
        return

    # Check the number of courses
    course_count = PublishedShifu.query.filter(PublishedShifu.deleted == 0).count()
    if course_count != 1:
        return

    # Set the first user as admin and creator
    first_user = User.query.filter(User.user_id == user_id).first()
    if first_user:
        first_user.is_admin = True
        first_user.is_creator = True

    # Get the only course
    course = (
        PublishedShifu.query.filter(PublishedShifu.deleted == 0)
        .order_by(PublishedShifu.id.asc())
        .first()
    )
    # The creator of the updated course
    course.created_user_id = user_id
    db.session.flush()
