import asyncio
from datetime import datetime, time as dtime
from loguru import logger

from config import PKT
from scrapers.psx_market import (
    ProxyRotator,
    TradingBoardScraper,
    MarketIndicesScraper,
    MarketWatchScraper,
    IndexCompositionScraper,
    CompanyProfileScraper,
)
from scrapers.candle_builder import CandleBuilder
from analytics.ratio_calculator import SectorAnalyticsEngine


class PSXScheduler:
    def __init__(self):
        self.rotator = ProxyRotator()
        self.trading_scraper = TradingBoardScraper(self.rotator)
        self.indices_scraper = MarketIndicesScraper(self.rotator)
        self.market_watch_scraper = MarketWatchScraper(self.rotator)
        self.composition_scraper = IndexCompositionScraper(self.rotator)
        self.profile_scraper = CompanyProfileScraper(self.rotator)
        self.sector_engine = SectorAnalyticsEngine()
        self.candle_builder = CandleBuilder()

    def is_market_hours(self) -> bool:
        """Checks if current time is Monday-Friday between 09:15 AM and 03:35 PM PKT."""
        now = datetime.now(PKT)
        if now.weekday() >= 5:  # Saturday & Sunday closed
            return False
        return dtime(9, 15) <= now.time() <= dtime(15, 35)

    # =========================================================================
    # 1. LIVE WORKERS (Active ONLY during market hours)
    # =========================================================================
    async def task_trading_board(self):
        """Streams live 2.5s depth and ticker prices during market hours."""
        logger.info("🟢 Trading Board worker initialized.")
        while True:
            try:
                if self.is_market_hours():
                    await self.trading_scraper.scrape_and_broadcast()
                    await asyncio.sleep(2.5)
                else:
                    # Market closed: sleep for 60 seconds
                    await asyncio.sleep(60.0)
            except Exception as e:
                logger.error(f"Error in Trading Board: {e}")
                await asyncio.sleep(5.0)

    async def task_market_indices(self):
        """Streams live 10s index points (KSE100, KMI30) during market hours."""
        logger.info("🟢 Market Indices worker initialized.")
        while True:
            try:
                if self.is_market_hours():
                    await self.indices_scraper.scrape_and_broadcast()
                    await asyncio.sleep(10.0)
                else:
                    await asyncio.sleep(60.0)
            except Exception as e:
                logger.error(f"Error in Market Indices: {e}")
                await asyncio.sleep(10.0)

    async def task_candle_builder(self):
        """Builds 1-minute OHLC candlestick snapshots every 60s during market hours."""
        logger.info("🟢 1-Minute Candle Builder initialized.")
        while True:
            try:
                if self.is_market_hours():
                    self.candle_builder.build_1m_candles()
                await asyncio.sleep(60.0)
            except Exception as e:
                logger.error(f"Error in Candle Builder: {e}")
                await asyncio.sleep(10.0)

    async def task_sector_analytics(self):
        """Computes sector & index valuations every 60s during market hours."""
        logger.info("🟢 Sector Valuations worker initialized.")
        while True:
            try:
                if self.is_market_hours():
                    self.sector_engine.compute_and_cache_all()
                    await asyncio.sleep(60.0)
                else:
                    await asyncio.sleep(300.0)
            except Exception as e:
                logger.error(f"Error in Sector Analytics: {e}")
                await asyncio.sleep(15.0)

    # =========================================================================
    # 2. DAILY PRE-MARKET SYNC (Runs once a day at 08:30 AM PKT before open)
    # =========================================================================
    async def task_daily_pre_market_sync(self):
        """Runs heavy syncs (Profiles, Financials, Ratios, Index Weightages) at 08:30 AM."""
        logger.info("🟢 Daily Pre-Market Sync scheduled for 08:30 AM PKT.")
        
        # Initial run on server start
        await self._run_full_daily_sync()

        while True:
            now = datetime.now(PKT)
            target = now.replace(hour=8, minute=30, second=0, microsecond=0)
            if now >= target:
                target = target.replace(day=now.day + 1)

            wait_seconds = (target - now).total_seconds()
            logger.info(f"⏳ Next Pre-Market Sync in {round(wait_seconds / 3600, 1)} hours.")
            await asyncio.sleep(wait_seconds)

            if datetime.now(PKT).weekday() < 5:  # Only Mon-Fri
                await self._run_full_daily_sync()

    async def _run_full_daily_sync(self):
        """Executes the daily deep scrape pipeline."""
        logger.info("🌅 Starting Daily Pre-Market Fundamentals & Profiles Sync...")
        try:
            # 1. Sync Market Watch & Sectors
            await self.market_watch_scraper.scrape_and_sync()
            # 2. Sync Index Compositions & Weightages
            await self.composition_scraper.scrape_all_indices()
            # 3. Sync Deep Company Profiles, Financials, Ratios & VAR
            await self.profile_scraper.scrape_all_active_companies(limit=500)
            # 4. Compute Initial Valuations
            self.sector_engine.compute_and_cache_all()
            logger.info("🚀 Daily Pre-Market Sync Completed Successfully!")
        except Exception as e:
            logger.error(f"Error during Daily Pre-Market Sync: {e}")

    # =========================================================================
    # MASTER RUNNER
    # =========================================================================
    async def start(self):
        logger.info("🚀 Starting PSX Platform Ingestion & Analytics Engine...")
        await asyncio.gather(
            self.task_trading_board(),
            self.task_market_indices(),
            self.task_candle_builder(),
            self.task_sector_analytics(),
            self.task_daily_pre_market_sync(),
        )


if __name__ == "__main__":
    scheduler = PSXScheduler()
    try:
        asyncio.run(scheduler.start())
    except (KeyboardInterrupt, SystemExit):
        logger.info("🛑 PSX Engine stopped gracefully.")