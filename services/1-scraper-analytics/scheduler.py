import os
import asyncio
from datetime import datetime, time as dtime
from aiohttp import web
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
        now = datetime.now(PKT)
        if now.weekday() >= 5:
            return False
        return dtime(9, 15) <= now.time() <= dtime(15, 35)

    # --- Live Workers ---
    async def task_trading_board(self):
        logger.info("🟢 Trading Board worker initialized.")
        while True:
            try:
                if self.is_market_hours():
                    await self.trading_scraper.scrape_and_broadcast()
                    await asyncio.sleep(2.5)
                else:
                    await asyncio.sleep(60.0)
            except Exception as e:
                logger.error(f"Error in Trading Board: {e}")
                await asyncio.sleep(5.0)

    async def task_market_indices(self):
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

    # --- Daily Sync ---
    async def task_daily_pre_market_sync(self):
        logger.info("🟢 Daily Pre-Market Sync scheduled for 08:30 AM PKT.")
        await self._run_full_daily_sync()

        while True:
            now = datetime.now(PKT)
            target = now.replace(hour=8, minute=30, second=0, microsecond=0)
            if now >= target:
                target = target.replace(day=now.day + 1)

            wait_seconds = (target - now).total_seconds()
            logger.info(f"⏳ Next Pre-Market Sync in {round(wait_seconds / 3600, 1)} hours.")
            await asyncio.sleep(wait_seconds)

            if datetime.now(PKT).weekday() < 5:
                await self._run_full_daily_sync()

    async def _run_full_daily_sync(self):
        logger.info("🌅 Starting Daily Pre-Market Fundamentals & Profiles Sync...")
        try:
            await self.market_watch_scraper.scrape_and_sync()
            await self.composition_scraper.scrape_all_indices()
            await self.profile_scraper.scrape_all_active_companies(limit=500)
            self.sector_engine.compute_and_cache_all()
            logger.info("🚀 Daily Pre-Market Sync Completed Successfully!")
        except Exception as e:
            logger.error(f"Error during Daily Pre-Market Sync: {e}")

    # --- Free Web Server for Render Health Check ---
    async def start_http_server(self):
        async def handle_health(request):
            return web.Response(text="Scraper is running 24/7 healthy!")

        app = web.Application()
        app.router.add_get("/", handle_health)
        app.router.add_get("/healthz", handle_health)

        port = int(os.getenv("PORT", 10000))
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", port)
        await site.start()
        logger.info(f"🌐 Free Health server listening on port {port}")

    async def start(self):
        logger.info("🚀 Starting PSX Platform Ingestion & Analytics Engine on Free Tier...")
        await asyncio.gather(
            self.start_http_server(),
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