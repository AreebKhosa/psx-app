from loguru import logger
from database.db_writer import get_db_connection

class CandleBuilder:
    @staticmethod
    def build_1m_candles():
        """Snapshots live market prices and builds 1-minute OHLC candles for all active stocks."""
        query = """
            INSERT INTO stock_candles_1m (symbol_id, open, high, low, close, volume, timestamp)
            SELECT 
                s.id,
                COALESCE(lmd.current_price, s.ldcp) AS open,
                COALESCE(lmd.current_price, s.ldcp) AS high,
                COALESCE(lmd.current_price, s.ldcp) AS low,
                COALESCE(lmd.current_price, s.ldcp) AS close,
                COALESCE(lmd.total_volume, 0) AS volume,
                date_trunc('minute', NOW()) AS timestamp
            FROM symbols s
            JOIN live_market_depth lmd ON s.id = lmd.symbol_id
            WHERE s.is_active = TRUE AND lmd.current_price > 0
            ON CONFLICT (symbol_id, timestamp) DO UPDATE SET
                high = GREATEST(stock_candles_1m.high, EXCLUDED.close),
                low = LEAST(stock_candles_1m.low, EXCLUDED.close),
                close = EXCLUDED.close,
                volume = EXCLUDED.volume;
        """
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(query)
                    conn.commit()
            logger.info("🕯️ 1-Minute Candlesticks generated for all active stocks.")
        except Exception as e:
            logger.error(f"Error building 1m candles: {e}")