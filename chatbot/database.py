import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.environ.get("DATABASE_URL", "mysql+pymysql://root@127.0.0.1/athena")

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
