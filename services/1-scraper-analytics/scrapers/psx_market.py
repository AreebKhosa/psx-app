import re
import json
import asyncio
from itertools import cycle
from typing import Optional, Dict, Any, List
import httpx
from bs4 import BeautifulSoup
from fake_useragent import UserAgent
from loguru import logger

from config import PROXIES, REQUEST_TIMEOUT
from database.db_writer import DBWriter, get_db_connection





# =====================================================================
# 1. PROXY ROTATOR & HTTP CLIENT
# =====================================================================




class ProxyRotator:
    def __init__(self, proxy_list: Optional[List[str]] = None, timeout: float = REQUEST_TIMEOUT):
        self.raw_proxies = proxy_list or PROXIES
        print("proxy_list",self.raw_proxies)
        self.proxy_pool = cycle(self.raw_proxies) if self.raw_proxies else None
        self.timeout = timeout
        self.ua = UserAgent()

    def get_headers(self) -> Dict[str, str]:
        return {
            "User-Agent": self.ua.random,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8,application/json",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://dps.psx.com.pk/",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

    def get_next_proxy(self) -> Optional[str]:
        return next(self.proxy_pool) if self.proxy_pool else None

    async def fetch(
        self, 
        url: str, 
        max_retries: int = 3, 
        params: Optional[Dict[str, Any]] = None
    ) -> Optional[httpx.Response]:
        """Sends an async GET request supporting all versions of httpx proxies."""
        for attempt in range(1, max_retries + 1):
            proxy_url = self.get_next_proxy()
            headers = self.get_headers()

            client_kwargs = {
                "timeout": self.timeout,
                "verify": False,
                "follow_redirects": True,
            }

            try:
                # 1. Try modern httpx (proxy=...)
                if proxy_url:
                    try:
                        async with httpx.AsyncClient(proxies=proxy_url, **client_kwargs) as client:
                            response = await client.get(url, headers=headers, params=params)
                            if response.status_code == 200:
                                return response
                    except TypeError:
                        # 2. Fallback for older httpx (proxies=...)
                        async with httpx.AsyncClient(proxies=proxy_url, **client_kwargs) as client:
                            response = await client.get(url, headers=headers, params=params)
                            if response.status_code == 200:
                                return response
                else:
                    # No proxy provided (Direct connection)
                    async with httpx.AsyncClient(**client_kwargs) as client:
                        response = await client.get(url, headers=headers, params=params)
                        if response.status_code == 200:
                            return response

                logger.warning(f"[Attempt {attempt}/{max_retries}] Status {response.status_code} for {url}")

            except Exception as exc:
                logger.error(f"[Attempt {attempt}/{max_retries}] Fetch error on {url}: {exc}")

            await asyncio.sleep(0.5)

        logger.critical(f"❌ All {max_retries} attempts failed for: {url}")
        return None

# Helper function to clean numbers from HTML tables
def clean_num(val_str: str, is_float: bool = False):
    if not val_str:
        return None
    val = val_str.replace(",", "").replace("%", "").strip()
    is_neg = "(" in val and ")" in val
    val = val.replace("(", "").replace(")", "").strip()
    try:
        num = float(val) if is_float else int(float(val))
        return -num if is_neg else num
    except ValueError:
        return None


# =====================================================================
# 2. TRADING BOARD SCRAPER (Live 2.5s Depth & Tickers)
# =====================================================================
class TradingBoardScraper:
    def __init__(self, rotator: ProxyRotator):
        self.rotator = rotator
        self.url = "https://dps.psx.com.pk/trading-board/REG/main"

    async def scrape_and_broadcast(self) -> bool:
        response = await self.rotator.fetch(self.url)
        if not response or response.status_code != 200:
            return False

        soup = BeautifulSoup(response.text, "lxml")
        table_body = soup.find("tbody", class_="tbl__body")
        if not table_body:
            return False

        live_data = []
        for row in table_body.find_all("tr"):
            tds = row.find_all("td")
            if len(tds) < 9:
                continue
            try:
                symbol_tag = tds[0].find("a", class_="tbl__symbol")
                ticker = symbol_tag.find("strong").text.strip() if symbol_tag else tds[0].text.strip()
                bid_vol = int(float(tds[2].get("data-order", tds[2].text.replace(",", "").strip() or 0)))
                bid_price = float(tds[3].get("data-order", tds[3].text.replace(",", "").strip() or 0.0))
                offer_vol = int(float(tds[4].get("data-order", tds[4].text.replace(",", "").strip() or 0)))
                offer_price = float(tds[5].get("data-order", tds[5].text.replace(",", "").strip() or 0.0))
                ldcp = float(tds[6].get("data-order", tds[6].text.replace(",", "").strip() or 0.0))
                price_change = float(tds[7].get("data-order", tds[7].text.replace(",", "").strip() or 0.0))
                volume = int(float(tds[8].get("data-order", tds[8].text.replace(",", "").strip() or 0)))
                current_price = round(ldcp + price_change, 2)
                change_pct = round((price_change / ldcp * 100), 2) if ldcp > 0 else 0.0

                live_data.append({
                    "ticker": ticker,
                    "bid_volume": bid_vol,
                    "bid_price": bid_price,
                    "offer_volume": offer_vol,
                    "offer_price": offer_price,
                    "current_price": current_price,
                    "price_change": price_change,
                    "change_pct": change_pct,
                    "total_volume": volume,
                    "ldcp": ldcp
                })
            except Exception:
                continue

        DBWriter.upsert_live_market_depth(live_data)
        return True






# =====================================================================
# 3. MARKET INDICES SCRAPER (KSE100, KMI30, etc.)
# =====================================================================




class MarketIndicesScraper:
    def __init__(self, rotator: ProxyRotator):
        self.rotator = rotator
        self.url = "https://dps.psx.com.pk/indices"

    async def scrape_and_broadcast(self) -> bool:
        response = await self.rotator.fetch(self.url)
        if not response or response.status_code != 200:
            return False

        soup = BeautifulSoup(response.text, "lxml")
        table_body = soup.find("tbody", class_="tbl__body")
        if not table_body:
            return False

        indices_data = []
        for row in table_body.find_all("tr"):
            tds = row.find_all("td")
            if len(tds) < 6:
                continue
            try:
                link_tag = tds[0].find("a")
                index_code = link_tag.get("data-code", "").strip() if link_tag else tds[0].text.strip()
                index_code = index_code.replace(" ", "").upper()

                indices_data.append({
                    "index_code": index_code,
                    "high_value": float(tds[1].get("data-order", tds[1].text.replace(",", "").strip() or 0.0)),
                    "low_value": float(tds[2].get("data-order", tds[2].text.replace(",", "").strip() or 0.0)),
                    "current_value": float(tds[3].get("data-order", tds[3].text.replace(",", "").strip() or 0.0)),
                    "change_points": float(tds[4].get("data-order", tds[4].text.replace(",", "").strip() or 0.0)),
                    "change_pct": float(tds[5].get("data-order", tds[5].text.replace("%", "").replace(",", "").strip() or 0.0)),
                })
            except Exception:
                continue

        DBWriter.insert_market_indices(indices_data)
        return True







# =====================================================================
# 4. MARKET WATCH SCRAPER (Master Directory & Sectors)
# =====================================================================



# Add this dictionary at the top or above MarketWatchScraper in psx_market.py:
PSX_SECTORS_DATA = {
    "0801": {"name": "AUTOMOBILE ASSEMBLER"},
    "0802": {"name": "AUTOMOBILE PARTS & ACCESSORIES"},
    "0803": {"name": "CABLE & ELECTRICAL GOODS"},
    "0804": {"name": "CEMENT"},
    "0805": {"name": "CHEMICAL"},
    "0806": {"name": "CLOSE - END MUTUAL FUND"},
    "0807": {"name": "COMMERCIAL BANKS"},
    "0808": {"name": "ENGINEERING"},
    "0809": {"name": "FERTILIZER"},
    "0810": {"name": "FOOD & PERSONAL CARE PRODUCTS"},
    "0811": {"name": "GLASS & CERAMICS"},
    "0812": {"name": "INSURANCE"},
    "0813": {"name": "INV. BANKS / INV. COS. / SECURITIES COS."},
    "0814": {"name": "JUTE"},
    "0815": {"name": "LEASING COMPANIES"},
    "0816": {"name": "LEATHER & TANNERIES"},
    "0818": {"name": "MISCELLANEOUS"},
    "0819": {"name": "MODARABAS"},
    "0820": {"name": "OIL & GAS EXPLORATION COMPANIES"},
    "0821": {"name": "OIL & GAS MARKETING COMPANIES"},
    "0822": {"name": "PAPER, BOARD & PACKAGING"},
    "0823": {"name": "PHARMACEUTICALS"},
    "0824": {"name": "POWER GENERATION & DISTRIBUTION"},
    "0825": {"name": "REFINERY"},
    "0826": {"name": "SUGAR & ALLIED INDUSTRIES"},
    "0827": {"name": "SYNTHETIC & RAYON"},
    "0828": {"name": "TECHNOLOGY & COMMUNICATION"},
    "0829": {"name": "TEXTILE COMPOSITE"},
    "0830": {"name": "TEXTILE SPINNING"},
    "0831": {"name": "TEXTILE WEAVING"},
    "0832": {"name": "TOBACCO"},
    "0833": {"name": "TRANSPORT"},
    "0834": {"name": "VANASPATI & ALLIED INDUSTRIES"},
    "0835": {"name": "WOOLLEN"},
    "0836": {"name": "REAL ESTATE INVESTMENT TRUST"},
    "0837": {"name": "EXCHANGE TRADED FUNDS"},
    "0838": {"name": "PROPERTY"},
    "0839": {"name": "APPAREL"}
}


# Update MarketWatchScraper class:
class MarketWatchScraper:
    def __init__(self, rotator: ProxyRotator):
        self.rotator = rotator
        self.url = "https://dps.psx.com.pk/market-watch"

    async def scrape_and_sync(self) -> bool:
        # 1. Sync all 38 sectors FIRST so foreign keys never fail
        DBWriter.sync_sectors(PSX_SECTORS_DATA)

        response = await self.rotator.fetch(self.url)
        if not response or response.status_code != 200:
            return False

        soup = BeautifulSoup(response.text, "lxml")
        table_body = soup.find("tbody", class_="tbl__body")
        if not table_body:
            return False

        parsed_stocks = []
        for row in table_body.find_all("tr"):
            tds = row.find_all("td")
            if len(tds) < 11:
                continue
            try:
                symbol_tag = tds[0].find("a", class_="tbl__symbol")
                ticker = symbol_tag.find("strong").text.strip() if symbol_tag else tds[0].text.strip()
                company_name = symbol_tag.get("data-title", ticker).strip() if symbol_tag else ticker
                sector_code = tds[1].text.strip()
                sector_name = PSX_SECTORS_DATA.get(sector_code, {}).get("name", "MISCELLANEOUS")
                listed_raw = tds[2].text.strip()
                listed_in = [idx.strip() for idx in listed_raw.split(",") if idx.strip()]

                parsed_stocks.append({
                    "ticker": ticker,
                    "name": company_name,
                    "sector_code": sector_code,
                    "sector_name": sector_name,
                    "listed_in": listed_in,
                    "ldcp": float(tds[3].get("data-order", tds[3].text.replace(",", "").strip() or 0.0)),
                    "open_price": float(tds[4].get("data-order", tds[4].text.replace(",", "").strip() or 0.0)),
                    "day_high": float(tds[5].get("data-order", tds[5].text.replace(",", "").strip() or 0.0)),
                    "day_low": float(tds[6].get("data-order", tds[6].text.replace(",", "").strip() or 0.0)),
                })
            except Exception:
                continue

        # 2. Upsert stocks directory safely
        DBWriter.upsert_symbols(parsed_stocks)
        logger.info(f"🚀 Successfully stored {len(parsed_stocks)} stocks and synced master sectors!")
        return True


        
# =====================================================================
# 5. ALL 15+ PSX INDICES COMPOSITION SCRAPER
# =====================================================================
class IndexCompositionScraper:
    def __init__(self, rotator: ProxyRotator):
        self.rotator = rotator
        self.base_url = "https://dps.psx.com.pk/indices"
        # ALL official PSX tradable & benchmark indices:
        self.indices = [
            "KSE100", "KSE30", "KMI30", "ALLSHR", "KMIALLSHR", 
            "BKTI", "OGTI", "NITPGI", "NBPPGI", "UPP9", 
            "MII30", "JSGBI", "JSMFI", "ACI", "PSXDIV20"
        ]

    async def scrape_all_indices(self):
        logger.info(f"⏳ Starting Daily Index Composition Sync for ALL {len(self.indices)} PSX indices...")
        for index_code in self.indices:
            try:
                response = await self.rotator.fetch(f"{self.base_url}/{index_code}")
                if not response or response.status_code != 200:
                    continue

                soup = BeautifulSoup(response.text, "lxml")
                table_body = soup.find("tbody", class_="tbl__body") or soup.find("tbody")
                if not table_body:
                    continue

                stocks = []
                for row in table_body.find_all("tr"):
                    tds = row.find_all("td")
                    if len(tds) < 8:
                        continue
                    try:
                        symbol_tag = tds[0].find("a", class_="tbl__symbol") or tds[0].find("a")
                        ticker = symbol_tag.find("strong").text.strip() if (symbol_tag and symbol_tag.find("strong")) else tds[0].text.strip()
                        
                        # Weightage %
                        wtg_raw = tds[6].text.replace("%", "").replace(",", "").strip() if len(tds) > 6 else "0"
                        weightage = float(wtg_raw) if wtg_raw else 0.0
                        
                        # Index Points
                        idx_point = float(tds[7].get("data-order", tds[7].text.replace(",", "").strip() or 0.0)) if len(tds) > 7 else 0.0
                        
                        # Free Float & Market Cap (Millions)
                        free_float_m, market_cap_m = 0.0, 0.0
                        if len(tds) > 9:
                            ff_raw = float(tds[9].get("data-order", tds[9].text.replace(",", "").strip() or 0))
                            free_float_m = round(ff_raw / 1_000_000, 2) if ff_raw > 1000 else ff_raw
                        if len(tds) > 10:
                            mc_raw = float(tds[10].get("data-order", tds[10].text.replace(",", "").strip() or 0))
                            market_cap_m = round(mc_raw / 1_000_000, 2) if mc_raw > 1000 else mc_raw

                        stocks.append({
                            "index_code": index_code,
                            "ticker": ticker,
                            "weightage": weightage,
                            "idx_point": idx_point,
                            "free_float_m": free_float_m,
                            "market_cap_m": market_cap_m,
                        })
                    except Exception:
                        continue

                if stocks:
                    DBWriter.upsert_index_composition(stocks, index_code)
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.warning(f"Error scraping index {index_code}: {e}")
        logger.info("🚀 All 15+ PSX Indices Compositions & Weightages Synced!")







# =====================================================================
# 6. COMPANY PROFILE, FINANCIALS, RATIOS & PAYOUTS SCRAPER (FIXED)
# =====================================================================
class CompanyProfileScraper:
    def __init__(self, rotator: ProxyRotator):
        self.rotator = rotator
        self.base_url = "https://dps.psx.com.pk/company"

    async def scrape_all_active_companies(self, limit: int = 500):
        tickers = DBWriter.get_active_tickers(limit=limit)
        logger.info(f"⏳ Starting Deep Fundamentals Scrape for {len(tickers)} companies...")

        for symbol_id, ticker in tickers:
            try:
                response = await self.rotator.fetch(f"{self.base_url}/{ticker}")
                if not response or response.status_code != 200:
                    continue
                self._parse_and_save(symbol_id, ticker, response.text)
                logger.info(f"✅ Synced Profile, Financials, Ratios & Payouts for: [{ticker}]")
                await asyncio.sleep(0.3)
            except Exception as e:
                logger.warning(f"Error scraping profile for {ticker}: {e}")

    def _parse_and_save(self, symbol_id: str, ticker: str, html: str):
        soup = BeautifulSoup(html, "lxml")

        # 1. Profile & People
        desc_tag = soup.find("div", class_="profile__item--decription")
        description = desc_tag.find("p").text.strip() if desc_tag and desc_tag.find("p") else ""

        ceo, chairperson, auditor, fiscal_year, website, address = "", "", "", "", "", ""
        people_table = soup.find("div", class_="profile__item--people")
        if people_table:
            for row in people_table.find_all("tr"):
                text = row.text
                if "CEO" in text:
                    ceo = row.find("strong").text.strip() if row.find("strong") else ""
                elif "Chairperson" in text or "Chairman" in text:
                    chairperson = row.find("strong").text.strip() if row.find("strong") else ""

        for it in soup.find_all("div", class_="profile__item"):
            head = it.find("div", class_="item__head")
            if not head: continue
            h_text = head.text.strip().upper()
            p_text = it.find("p").text.strip() if it.find("p") else ""
            if "ADDRESS" in h_text: address = p_text
            elif "WEBSITE" in h_text: website = it.find("a").text.strip() if it.find("a") else p_text
            elif "AUDITOR" in h_text: auditor = p_text
            elif "FISCAL YEAR" in h_text: fiscal_year = p_text

        # 2. Equity Stats
        total_shares, free_float_shares, free_float_pct = 0, 0, 0.0
        equity_sec = soup.find("div", id="equity")
        if equity_sec:
            for st in equity_sec.find_all("div", class_="stats_item"):
                lbl = st.find("div", class_="stats_label").text.strip() if st.find("div", class_="stats_label") else ""
                val = st.find("div", class_="stats_value").text.strip() if st.find("div", class_="stats_value") else ""
                if "Shares" in lbl: total_shares = clean_num(val) or 0
                elif "Free Float" in lbl and "%" not in val: free_float_shares = clean_num(val) or 0
                elif "Free Float" in lbl and "%" in val: free_float_pct = clean_num(val, is_float=True) or 0.0

        # 3. Ranges & Risk
        circuit_low, circuit_high, week52_low, week52_high = 0.0, 0.0, 0.0, 0.0
        current_var, current_haircut = 0.0, 0.0

        range_stats = soup.find("div", class_="company__quote__rangeStats")
        if range_stats:
            for item in range_stats.find_all("div", class_="stats_item"):
                lbl = item.find("div", class_="stats_label").text.strip().upper() if item.find("div", class_="stats_label") else ""
                num_range = item.find("div", class_="numRange")
                if num_range:
                    low = float(num_range.get("data-low", 0.0))
                    high = float(num_range.get("data-high", 0.0))
                    if "CIRCUIT" in lbl: circuit_low, circuit_high = low, high
                    elif "52-WEEK" in lbl or "YEAR" in lbl: week52_low, week52_high = low, high

        for item in soup.find_all("div", class_="stats_item"):
            lbl = item.find("div", class_="stats_label")
            val = item.find("div", class_="stats_value")
            if not lbl or not val: continue
            lbl_text = lbl.text.strip().upper()
            val_text = val.text.replace("%", "").strip()
            try:
                if lbl_text == "VAR": current_var = float(val_text)
                elif lbl_text == "HAIRCUT": current_haircut = float(val_text)
            except ValueError:
                pass

        # 4. Financials (Annual & Quarterly)
        financial_rows = []
        for panel in soup.find_all("div", class_="tabs__panel"):
            p_type = panel.get("data-name", "Annual").upper()
            tbl = panel.find("table", class_="tbl")
            if not tbl: continue
            headers = [th.text.strip() for th in tbl.find("thead").find_all("th")[1:]] if tbl.find("thead") else []
            tbody = tbl.find("tbody")
            if not tbody: continue

            sales_row, pat_row, eps_row = [], [], []
            for tr in tbody.find_all("tr"):
                row_label = tr.find("td").text.strip() if tr.find("td") else ""
                vals = [td.text.strip() for td in tr.find_all("td")[1:]]
                if "Sales" in row_label: sales_row = vals
                elif "Profit after Taxation" in row_label or "PAT" in row_label: pat_row = vals
                elif "EPS" in row_label: eps_row = vals

            for i, period_label in enumerate(headers):
                financial_rows.append({
                    "symbol_id": symbol_id,
                    "period_type": p_type,
                    "period_label": period_label,
                    "sales": clean_num(sales_row[i]) if i < len(sales_row) else None,
                    "pat": clean_num(pat_row[i]) if i < len(pat_row) else None,
                    "eps": clean_num(eps_row[i], is_float=True) if i < len(eps_row) else None,
                })

        # 5. Ratios
        ratios_rows = []
        ratios_sec = soup.find("div", class_="company__ratios") or soup.find("div", id="ratios")
        if ratios_sec and ratios_sec.find("table"):
            r_tbl = ratios_sec.find("table")
            years = [th.text.strip() for th in r_tbl.find("thead").find_all("th")[1:]] if r_tbl.find("thead") else []
            gm_row, nm_row, epsg_row, peg_row = [], [], [], []
            for tr in r_tbl.find("tbody").find_all("tr") if r_tbl.find("tbody") else []:
                lbl = tr.find("td").text.strip() if tr.find("td") else ""
                vals = [td.text.strip() for td in tr.find_all("td")[1:]]
                if "Gross Profit Margin" in lbl: gm_row = vals
                elif "Net Profit Margin" in lbl: nm_row = vals
                elif "EPS Growth" in lbl: epsg_row = vals
                elif "PEG" in lbl: peg_row = vals

            for i, yr in enumerate(years):
                ratios_rows.append({
                    "symbol_id": symbol_id,
                    "period_year": yr,
                    "gross_margin_pct": clean_num(gm_row[i], is_float=True) if i < len(gm_row) else None,
                    "net_margin_pct": clean_num(nm_row[i], is_float=True) if i < len(nm_row) else None,
                    "eps_growth_pct": clean_num(epsg_row[i], is_float=True) if i < len(epsg_row) else None,
                    "peg": clean_num(peg_row[i], is_float=True) if i < len(peg_row) else None,
                })

        # 6. PARSE PAYOUTS & BOOK CLOSURES (Multi-Selector Fix)
        payouts_rows = []
        payouts_sec = (
            soup.find("div", id="payouts") or 
            soup.find("div", class_="company__payouts") or 
            soup.find("div", attrs={"data-name": "Payouts"})
        )
        
        payout_table = payouts_sec.find("table") if payouts_sec else None
        if not payout_table:
            # Fallback: search for any table containing dividend headers
            for tbl in soup.find_all("table"):
                if "Dividend" in tbl.text or "Book Closure" in tbl.text:
                    payout_table = tbl
                    break

        if payout_table:
            tbody = payout_table.find("tbody") or payout_table
            for tr in tbody.find_all("tr"):
                tds = tr.find_all("td")
                if len(tds) >= 3:
                    ann_date = tds[0].text.strip()
                    fin_res = tds[1].text.strip() if len(tds) > 1 else ""
                    div_det = tds[2].text.strip() if len(tds) > 2 else ""
                    bk_close = tds[3].text.strip() if len(tds) > 3 else ""

                    if ann_date and div_det:
                        payouts_rows.append({
                            "symbol_id": symbol_id,
                            "announcement_date": ann_date,
                            "financial_results": fin_res,
                            "dividend_details": div_det,
                            "book_closure": bk_close,
                        })


        # 7. Persist ALL to Database
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # 1. Profiles Insert
                cur.execute("""
                    INSERT INTO company_profiles (
                        symbol_id, business_description, ceo, chairperson, auditor, 
                        fiscal_year_end, website, address, total_shares, free_float_shares, 
                        free_float_pct, circuit_low, circuit_high, week52_low, week52_high,
                        current_var, current_haircut, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (symbol_id) DO UPDATE SET
                        business_description = EXCLUDED.business_description,
                        ceo = EXCLUDED.ceo, chairperson = EXCLUDED.chairperson,
                        auditor = EXCLUDED.auditor, fiscal_year_end = EXCLUDED.fiscal_year_end,
                        website = EXCLUDED.website, address = EXCLUDED.address,
                        total_shares = EXCLUDED.total_shares, free_float_shares = EXCLUDED.free_float_shares,
                        free_float_pct = EXCLUDED.free_float_pct, circuit_low = EXCLUDED.circuit_low,
                        circuit_high = EXCLUDED.circuit_high, week52_low = EXCLUDED.week52_low,
                        week52_high = EXCLUDED.week52_high, current_var = EXCLUDED.current_var,
                        current_haircut = EXCLUDED.current_haircut, updated_at = NOW();
                """, (symbol_id, description, ceo, chairperson, auditor, fiscal_year, website, address,
                      total_shares, free_float_shares, free_float_pct, circuit_low, circuit_high,
                      week52_low, week52_high, current_var, current_haircut))

                # 👉 PUT IT RIGHT HERE:
                # 2. Daily VAR & Haircut Historical Logging
                if current_var > 0:
                    cur.execute("""
                        INSERT INTO stock_var_history (symbol_id, var_value, haircut, recorded_date)
                        VALUES (%s, %s, %s, CURRENT_DATE)
                        ON CONFLICT (symbol_id, recorded_date) DO UPDATE SET
                            var_value = EXCLUDED.var_value,
                            haircut = EXCLUDED.haircut;
                    """, (symbol_id, current_var, current_haircut))

                # 3. Financials Insert
                if financial_rows:
                    cur.executemany("""
                        INSERT INTO company_financials (symbol_id, period_type, period_label, sales, pat, eps, updated_at)
                        VALUES (%(symbol_id)s, %(period_type)s, %(period_label)s, %(sales)s, %(pat)s, %(eps)s, NOW())
                        ON CONFLICT (symbol_id, period_type, period_label) DO UPDATE SET
                            sales = EXCLUDED.sales, pat = EXCLUDED.pat, eps = EXCLUDED.eps, updated_at = NOW();
                    """, financial_rows)

                # 4. Ratios Insert
                if ratios_rows:
                    cur.executemany("""
                        INSERT INTO company_ratios (symbol_id, period_year, gross_margin_pct, net_margin_pct, eps_growth_pct, peg, updated_at)
                        VALUES (%(symbol_id)s, %(period_year)s, %(gross_margin_pct)s, %(net_margin_pct)s, %(eps_growth_pct)s, %(peg)s, NOW())
                        ON CONFLICT (symbol_id, period_year) DO UPDATE SET
                            gross_margin_pct = EXCLUDED.gross_margin_pct,
                            net_margin_pct = EXCLUDED.net_margin_pct,
                            eps_growth_pct = EXCLUDED.eps_growth_pct,
                            peg = EXCLUDED.peg, updated_at = NOW();
                    """, ratios_rows)

                # 5. Payouts Insert
                if payouts_rows:
                    cur.executemany("""
                        INSERT INTO company_payouts (symbol_id, announcement_date, financial_results, dividend_details, book_closure, updated_at)
                        VALUES (%(symbol_id)s, %(announcement_date)s, %(financial_results)s, %(dividend_details)s, %(book_closure)s, NOW())
                        ON CONFLICT (symbol_id, announcement_date, dividend_details) DO UPDATE SET
                            financial_results = EXCLUDED.financial_results,
                            book_closure = EXCLUDED.book_closure, updated_at = NOW();
                    """, payouts_rows)

                conn.commit()
    