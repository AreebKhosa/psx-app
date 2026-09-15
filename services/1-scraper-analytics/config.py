import os
import pytz
from dotenv import load_dotenv

# Load root .env file
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

# Environment & Timezone
NODE_ENV = os.getenv("NODE_ENV", "production")
PKT = pytz.timezone("Asia/Karachi")

# Database & Cache
DATABASE_URL = os.getenv("DATABASE_URL", "")
REDIS_URL = os.getenv("REDIS_URL", "")
REDIS_HOST = os.getenv("REDIS_HOST", "")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")

# AI Engine
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "")

# Scraper Proxy & Timings
PROXY_STR = os.getenv("PROXIES", "")
PROXIES = []
if PROXY_STR:
    # Split by comma and strip whitespace
    PROXIES = [p.strip() for p in PROXY_STR.split(",") if p.strip()]

print("PROXIES", PROXIES)
REQUEST_TIMEOUT = 12.0