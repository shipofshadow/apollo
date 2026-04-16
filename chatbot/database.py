import os
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase


def _build_database_url() -> str:
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return database_url

    db_host = os.environ.get("DB_HOST", "127.0.0.1")
    db_port = os.environ.get("DB_PORT", "3306")
    db_name = os.environ.get("DB_NAME", "athena")
    db_user = os.environ.get("DB_USER", "root")
    db_pass = os.environ.get("DB_PASS", "")
    db_charset = os.environ.get("DB_CHARSET", "utf8mb4")

    password = quote_plus(db_pass) if db_pass else ""
    user_pass = f"{db_user}:{password}@" if db_pass else f"{db_user}@"

    return f"mysql+pymysql://{user_pass}{db_host}:{db_port}/{db_name}?charset={db_charset}"


DATABASE_URL = _build_database_url()

# SQLite requires the check_same_thread=False connect arg; other engines do not.
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=_connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class MySQLMixin:
    """Forces InnoDB + utf8mb4 on every table when using MySQL/MariaDB.
    Inherit alongside Base: class MyModel(MySQLMixin, Base): ...
    """
    __table_args__ = {
        'mysql_engine': 'InnoDB',
        'mysql_charset': 'utf8mb4',
        'mysql_collate': 'utf8mb4_unicode_ci',
        'mariadb_engine': 'InnoDB',
    }


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
