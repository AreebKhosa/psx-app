import json
from contextlib import contextmanager
from loguru import logger
import psycopg2
from psycopg2.pool import ThreadedConnectionPool
import redis
from config import DATABASE_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_URL

# 1. Initialize PostgreSQL Connection Pool (Thread-safe)
try:
    db_pool = ThreadedConnectionPool(minconn=1, maxconn=10, dsn=DATABASE_URL)
    logger.info("✅ PostgreSQL connection pool initialized.")
except Exception as e:
    logger.critical(f"❌ Failed to initialize PostgreSQL pool: {e}")
    db_pool = None

# 2. Initialize Redis Client
try:
    redis_client = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        password=REDIS_PASSWORD,
        decode_responses=True,
        protocol=2,  # Compatible with all Redis servers
    )
    logger.info("✅ Redis client connected.")
except Exception as e:
    logger.warning(f"⚠️ Redis connection warning: {e}")
    redis_client = None


@contextmanager
def get_db_connection():
    """Context manager to borrow and return connections safely from the pool."""
    if db_pool is None:
        raise ConnectionError("Database connection pool is not initialized.")
    conn = db_pool.getconn()
    try:
        yield conn
    except Exception as err:
        conn.rollback()
        logger.error(f"Database error during transaction: {err}")
        raise
    finally:
        db_pool.putconn(conn)


class DBWriter:
    @staticmethod
    def get_active_tickers(limit: int = 600):
        """Fetch active stock tickers and their UUIDs."""
        query = "SELECT id, ticker FROM symbols WHERE is_active = TRUE ORDER BY ticker ASC LIMIT %s;"
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (limit,))
                return cur.fetchall()

    @staticmethod
    def sync_sectors(sectors_dict: dict):
        """Populates and updates the sectors master table."""
        query = """
            INSERT INTO sectors (code, name) VALUES (%s, %s)
            ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();
        """
        data = [(code, data["name"]) for code, data in sectors_dict.items()]
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(query, data)
                conn.commit()

    @staticmethod
    def upsert_symbols(stocks: list):
        """Upserts stock directory from Market Watch scraper."""
        if not stocks:
            return
        query = """
            INSERT INTO symbols (
                ticker, name, sector_code, sector_name, listed_in, ldcp, open_price, 
                day_high, day_low, updated_at
            ) VALUES (
                %(ticker)s, %(name)s, %(sector_code)s, %(sector_name)s, %(listed_in)s, 
                %(ldcp)s, %(open_price)s, %(day_high)s, %(day_low)s, NOW()
            )
            ON CONFLICT (ticker) DO UPDATE SET
                name = EXCLUDED.name,
                sector_code = EXCLUDED.sector_code,
                sector_name = EXCLUDED.sector_name,
                listed_in = EXCLUDED.listed_in,
                ldcp = EXCLUDED.ldcp,
                open_price = EXCLUDED.open_price,
                day_high = EXCLUDED.day_high,
                day_low = EXCLUDED.day_low,
                updated_at = NOW();
        """
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(query, stocks)
                conn.commit()

    @staticmethod
    def upsert_live_market_depth(live_data: list):
        """Updates live trading board prices in DB and broadcasts directly to Redis."""
        if not live_data:
            return

        # 1. Push to Redis (Fast Key: stock:TICKER)
        if redis_client:
            pipe = redis_client.pipeline()
            for item in live_data:
                pipe.set(f"stock:{item['ticker']}", json.dumps(item))
            pipe.execute()

        # 2. Batch Upsert to PostgreSQL
        query = """
            INSERT INTO live_market_depth (
                symbol_id, bid_price, bid_volume, offer_price, offer_volume,
                current_price, price_change, change_pct, total_volume, updated_at
            )
            SELECT 
                s.id, %(bid_price)s, %(bid_volume)s, %(offer_price)s, %(offer_volume)s,
                %(current_price)s, %(price_change)s, %(change_pct)s, %(total_volume)s, NOW()
            FROM symbols s 
            WHERE s.ticker = %(ticker)s
            ON CONFLICT (symbol_id) DO UPDATE SET
                bid_price = EXCLUDED.bid_price,
                bid_volume = EXCLUDED.bid_volume,
                offer_price = EXCLUDED.offer_price,
                offer_volume = EXCLUDED.offer_volume,
                current_price = EXCLUDED.current_price,
                price_change = EXCLUDED.price_change,
                change_pct = EXCLUDED.change_pct,
                total_volume = EXCLUDED.total_volume,
                updated_at = NOW();
        """
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(query, live_data)
                conn.commit()

    @staticmethod
    @staticmethod
    def insert_market_indices(indices_data: list):
        """Updates live index in Redis and logs 1 clean snapshot per minute in PostgreSQL for graphs."""
        if not indices_data:
            return

        # 1. Update Live Index in Redis (Always holds the latest price)
        if redis_client:
            pipe = redis_client.pipeline()
            for item in indices_data:
                pipe.set(f"index:{item['index_code']}", json.dumps(item))
            pipe.execute()

        # 2. Upsert 1-minute snapshot into DB for Graphs & Historical Charts
        query = """
            INSERT INTO market_indices (
                index_code, current_value, change_points, change_pct, 
                high_value, low_value, recorded_at
            ) VALUES (
                %(index_code)s, %(current_value)s, %(change_points)s, %(change_pct)s,
                %(high_value)s, %(low_value)s, date_trunc('minute', NOW())
            )
            ON CONFLICT (index_code, recorded_at) DO UPDATE SET
                current_value = EXCLUDED.current_value,
                change_points = EXCLUDED.change_points,
                change_pct = EXCLUDED.change_pct,
                high_value = GREATEST(market_indices.high_value, EXCLUDED.high_value),
                low_value = LEAST(market_indices.low_value, EXCLUDED.low_value);
        """
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(query, indices_data)
                conn.commit()

                
    @staticmethod
    def upsert_index_composition(stocks: list, index_code: str):
        """Updates weightage & idx_point in-place for existing stocks, or inserts if new."""
        if not stocks:
            return

        # 1. Update existing row or insert if new
        comp_query = """
            INSERT INTO index_composition (
                index_code, symbol_id, weightage, idx_point, updated_at
            )
            SELECT %(index_code)s, s.id, %(weightage)s, %(idx_point)s, NOW()
            FROM symbols s 
            WHERE s.ticker = %(ticker)s
            ON CONFLICT (index_code, symbol_id) DO UPDATE SET
                weightage = EXCLUDED.weightage,
                idx_point = EXCLUDED.idx_point,
                updated_at = NOW();
        """

        # 2. Update Free Float & Market Cap in symbols directory
        symbol_update_query = """
            UPDATE symbols
            SET free_float_m = %(free_float_m)s,
                market_cap_m = %(market_cap_m)s,
                updated_at = NOW()
            WHERE ticker = %(ticker)s AND %(free_float_m)s > 0;
        """

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(comp_query, stocks)
                cur.executemany(symbol_update_query, stocks)
                conn.commit()