from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
from pymongo import ASCENDING, DESCENDING
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from pymongo.operations import IndexModel


load_dotenv(Path(__file__).resolve().parent / ".env")

logger = logging.getLogger(__name__)

DATABASE_NAME = "krishna_vaani"


def _get_validated_mongo_uri() -> str:
    mongo_uri = os.getenv("MONGO_URI", "").strip()
    if not mongo_uri:
        raise ValueError("MONGO_URI is missing in backend/.env")

    parsed = urlparse(mongo_uri)
    if parsed.scheme not in {"mongodb", "mongodb+srv"}:
        raise ValueError("MONGO_URI must start with mongodb:// or mongodb+srv://")

    database_in_uri = parsed.path.lstrip("/")
    if not database_in_uri:
        raise ValueError("MONGO_URI must include database name in URI path, e.g. .../krishna_vaani?retryWrites=true&w=majority")

    return mongo_uri


MONGO_URI = _get_validated_mongo_uri()

USER_INPUTS_COLLECTION = "user_inputs"
GITA_VERSES_COLLECTION = "gita_verses"
SAVED_VERSES_COLLECTION = "saved_verses"
READING_PROGRESS_COLLECTION = "reading_progress"


@lru_cache(maxsize=1)
def get_mongo_client() -> MongoClient:
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
        client.admin.command("ping")
        logger.info("Connected to MongoDB Atlas")
        return client
    except PyMongoError as exc:
        logger.exception("MongoDB Atlas connection failed: %s", exc)
        raise


def get_database():
    return get_mongo_client()[DATABASE_NAME]


def get_user_inputs_collection():
    return get_database()[USER_INPUTS_COLLECTION]


def get_gita_verses_collection():
    return get_database()[GITA_VERSES_COLLECTION]


def get_saved_verses_collection():
    return get_database()[SAVED_VERSES_COLLECTION]


def get_reading_progress_collection():
    return get_database()[READING_PROGRESS_COLLECTION]


def ensure_indexes() -> None:
    database = get_database()

    database[GITA_VERSES_COLLECTION].create_indexes(
        [
            IndexModel([("emotion_tags", ASCENDING)], name="emotion_tags_idx"),
            IndexModel([("chapter_number", ASCENDING)], name="chapter_number_idx"),
            IndexModel(
                [("chapter_number", ASCENDING), ("verse_number", ASCENDING)],
                name="chapter_verse_unique_idx",
                unique=True,
            ),
        ]
    )

    database[USER_INPUTS_COLLECTION].create_indexes(
        [
            IndexModel([("timestamp", DESCENDING)], name="user_inputs_timestamp_idx"),
            IndexModel([("emotion", ASCENDING)], name="user_inputs_emotion_idx"),
        ]
    )

    database[SAVED_VERSES_COLLECTION].create_indexes(
        [
            IndexModel([("timestamp", DESCENDING)], name="saved_verses_timestamp_idx"),
            IndexModel([("emotion", ASCENDING)], name="saved_verses_emotion_idx"),
            IndexModel([("id", ASCENDING)], name="saved_verses_id_idx", unique=True),
        ]
    )

    database[READING_PROGRESS_COLLECTION].create_indexes(
        [
            IndexModel([("chapter", ASCENDING)], name="reading_progress_chapter_idx", unique=True),
            IndexModel([("last_read_date", DESCENDING)], name="reading_progress_last_read_date_idx"),
        ]
    )


def verify_mongo_connection() -> bool:
    try:
        get_mongo_client().admin.command("ping")
        logger.info(
            "Connected to MongoDB Atlas: database=%s collection=%s",
            DATABASE_NAME,
            USER_INPUTS_COLLECTION,
        )
        return True
    except PyMongoError as exc:
        logger.exception("MongoDB connection failed: %s", exc)
        return False
