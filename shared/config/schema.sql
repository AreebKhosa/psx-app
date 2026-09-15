-- ====================================================================
-- PSX DATABASE SCHEMA (UUID Primary Keys)
-- ====================================================================

-- Enable pgcrypto extension for UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. SECTORS (Populated by market_watch.py)
CREATE TABLE IF NOT EXISTS sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sectors_code ON sectors(code);

-- 2. SYMBOLS / MASTER STOCK DIRECTORY (Populated by market_watch.py & index_composition.py)
CREATE TABLE IF NOT EXISTS symbols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    sector_code VARCHAR(50) REFERENCES sectors(code) ON UPDATE CASCADE ON DELETE SET NULL,
    sector_name VARCHAR(255),
    listed_in TEXT[] DEFAULT '{}',
    ldcp NUMERIC(15, 2) DEFAULT 0.00,
    open_price NUMERIC(15, 2) DEFAULT 0.00,
    day_high NUMERIC(15, 2) DEFAULT 0.00,
    day_low NUMERIC(15, 2) DEFAULT 0.00,
    free_float_m NUMERIC(15, 2) DEFAULT 0.00,
    market_cap_m NUMERIC(15, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_symbols_ticker ON symbols(ticker);
CREATE INDEX IF NOT EXISTS idx_symbols_sector ON symbols(sector_code);
CREATE INDEX IF NOT EXISTS idx_symbols_active ON symbols(is_active);

-- 3. LIVE MARKET DEPTH (Populated by trading_board.py)
CREATE TABLE IF NOT EXISTS live_market_depth (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol_id UUID UNIQUE NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    bid_price NUMERIC(15, 2) DEFAULT 0.00,
    bid_volume BIGINT DEFAULT 0,
    offer_price NUMERIC(15, 2) DEFAULT 0.00,
    offer_volume BIGINT DEFAULT 0,
    current_price NUMERIC(15, 2) DEFAULT 0.00,
    price_change NUMERIC(15, 2) DEFAULT 0.00,
    change_pct NUMERIC(8, 2) DEFAULT 0.00,
    total_volume BIGINT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_depth_symbol ON live_market_depth(symbol_id);

-- 4. MARKET INDICES LIVE/HISTORY (Populated by market_indices.py)
CREATE TABLE IF NOT EXISTS market_indices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    index_code VARCHAR(50) NOT NULL,
    current_value NUMERIC(15, 2) NOT NULL,
    change_points NUMERIC(15, 2) NOT NULL,
    change_pct NUMERIC(8, 2) NOT NULL,
    high_value NUMERIC(15, 2) NOT NULL,
    low_value NUMERIC(15, 2) NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_indices_code_time ON market_indices(index_code, recorded_at DESC);

-- 5. INDEX COMPOSITION & WEIGHTAGES (Populated by index_composition.py)
CREATE TABLE IF NOT EXISTS index_composition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    index_code VARCHAR(50) NOT NULL,
    symbol_id UUID NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    weightage NUMERIC(8, 4) DEFAULT 0.0000,
    idx_point NUMERIC(15, 4) DEFAULT 0.0000,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_index_symbol UNIQUE (index_code, symbol_id)
);

CREATE INDEX IF NOT EXISTS idx_index_comp_lookup ON index_composition(index_code, symbol_id);

-- 6. COMPANY PROFILES & RISK METRICS (Populated by company_profile.py)
CREATE TABLE IF NOT EXISTS company_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol_id UUID UNIQUE NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    business_description TEXT,
    ceo VARCHAR(255),
    chairperson VARCHAR(255),
    auditor VARCHAR(255),
    fiscal_year_end VARCHAR(100),
    website TEXT,
    address TEXT,
    total_shares BIGINT DEFAULT 0,
    free_float_shares BIGINT DEFAULT 0,
    free_float_pct NUMERIC(8, 2) DEFAULT 0.00,
    circuit_low NUMERIC(15, 2) DEFAULT 0.00,
    circuit_high NUMERIC(15, 2) DEFAULT 0.00,
    week52_low NUMERIC(15, 2) DEFAULT 0.00,
    week52_high NUMERIC(15, 2) DEFAULT 0.00,
    current_var NUMERIC(8, 2) DEFAULT 0.00,
    current_haircut NUMERIC(8, 2) DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. STOCK DAILY VAR & HAIRCUT HISTORY (Populated by company_profile.py)
CREATE TABLE IF NOT EXISTS stock_var_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol_id UUID NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    var_value NUMERIC(8, 2) NOT NULL,
    haircut NUMERIC(8, 2) NOT NULL,
    recorded_date DATE NOT NULL,
    CONSTRAINT uq_stock_var_date UNIQUE (symbol_id, recorded_date)
);

CREATE INDEX IF NOT EXISTS idx_var_history_symbol_date ON stock_var_history(symbol_id, recorded_date DESC);

-- 8. COMPANY FINANCIALS: ANNUAL & QUARTERLY (Populated by company_profile.py)
CREATE TABLE IF NOT EXISTS company_financials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol_id UUID NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL,
    period_label VARCHAR(50) NOT NULL,
    sales BIGINT,
    pat BIGINT,
    eps NUMERIC(15, 2),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_company_fin_period UNIQUE (symbol_id, period_type, period_label)
);

CREATE INDEX IF NOT EXISTS idx_fin_symbol ON company_financials(symbol_id);

-- 9. COMPANY RATIOS (Populated by company_profile.py)
CREATE TABLE IF NOT EXISTS company_ratios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol_id UUID NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    period_year VARCHAR(20) NOT NULL,
    gross_margin_pct NUMERIC(8, 2),
    net_margin_pct NUMERIC(8, 2),
    eps_growth_pct NUMERIC(8, 2),
    peg NUMERIC(8, 2),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_company_ratio_year UNIQUE (symbol_id, period_year)
);

CREATE INDEX IF NOT EXISTS idx_ratios_symbol ON company_ratios(symbol_id);

-- 10. COMPANY PAYOUTS & BOOK CLOSURES (Populated by company_profile.py)
CREATE TABLE IF NOT EXISTS company_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol_id UUID NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    announcement_date VARCHAR(100) NOT NULL,
    financial_results TEXT,
    dividend_details TEXT NOT NULL,
    book_closure TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_payout_announcement UNIQUE (symbol_id, announcement_date, dividend_details)
);

CREATE INDEX IF NOT EXISTS idx_payouts_symbol ON company_payouts(symbol_id);

-- 11. OHLC 1-MINUTE CANDLESTICKS (Referenced by engine.py CandleBuilder)
CREATE TABLE IF NOT EXISTS stock_candles_1m (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol_id UUID NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    open NUMERIC(15, 2) NOT NULL,
    high NUMERIC(15, 2) NOT NULL,
    low NUMERIC(15, 2) NOT NULL,
    close NUMERIC(15, 2) NOT NULL,
    volume BIGINT DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_candle_symbol_time UNIQUE (symbol_id, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_candles_lookup ON stock_candles_1m(symbol_id, timestamp DESC);


-- 12. USERS (Authentication & Profile)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    avatar_url TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    role VARCHAR(20) DEFAULT 'user', -- 'user' or 'admin'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);


-- 13. PAPER TRADING PORTFOLIOS (User mock cash balances)
CREATE TABLE IF NOT EXISTS paper_portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cash_balance NUMERIC(15, 2) DEFAULT 1000000.00,  -- Default 1,000,000 PKR mock cash
    initial_balance NUMERIC(15, 2) DEFAULT 1000000.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. PAPER HOLDINGS (Stocks currently owned in portfolio)
CREATE TABLE IF NOT EXISTS paper_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES paper_portfolios(id) ON DELETE CASCADE,
    symbol_id UUID NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    avg_buy_price NUMERIC(15, 2) NOT NULL,
    total_invested NUMERIC(15, 2) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_portfolio_symbol UNIQUE (portfolio_id, symbol_id)
);

CREATE INDEX IF NOT EXISTS idx_holdings_portfolio ON paper_holdings(portfolio_id);

-- 15. PAPER ORDERS (Buy/Sell order history)
CREATE TABLE IF NOT EXISTS paper_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES paper_portfolios(id) ON DELETE CASCADE,
    symbol_id UUID NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    order_side VARCHAR(10) NOT NULL,       -- 'BUY' or 'SELL'
    order_type VARCHAR(10) NOT NULL,       -- 'MARKET' or 'LIMIT'
    target_price NUMERIC(15, 2) NOT NULL,  -- Requested price
    execution_price NUMERIC(15, 2),        -- Actual filled price
    quantity INT NOT NULL CHECK (quantity > 0),
    total_amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'FILLED',   -- 'FILLED', 'PENDING', 'CANCELLED'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_portfolio ON paper_orders(portfolio_id, created_at DESC);


-- 16. COMMUNITIES (Investor Groups / Channels)
CREATE TABLE IF NOT EXISTS communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    members_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. COMMUNITY MEMBERS
CREATE TABLE IF NOT EXISTS community_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- 'creator', 'admin', 'member'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_community_member UNIQUE (community_id, user_id)
);

-- 18. POSTS (With $CASHTAGS, #HASHTAGS, Images)
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    media_urls TEXT[] DEFAULT '{}',
    cashtags TEXT[] DEFAULT '{}',     -- Extracted tags like ['$LUCK', '$OGDC']
    hashtags TEXT[] DEFAULT '{}',     -- Extracted tags like ['#OIL', '#CEMENT']
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_community ON posts(community_id);
CREATE INDEX IF NOT EXISTS idx_posts_cashtags ON posts USING GIN(cashtags);

-- 19. POST LIKES
CREATE TABLE IF NOT EXISTS post_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_post_user_like UNIQUE (post_id, user_id)
);

-- 20. COMMENTS
CREATE TABLE IF NOT EXISTS post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON post_comments(post_id, created_at ASC);