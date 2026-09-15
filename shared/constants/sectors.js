// Complete PSX 38 Sectors with Macro Drivers & Descriptions
const PSX_SECTORS_DATA = Object.freeze({
    "0801": { name: "AUTOMOBILE ASSEMBLER", macro_tags: ["Auto Loan Rates", "CKD Import Duties", "Yen/USD Rate"], desc: "Driven by consumer financing interest rates and import tariffs." },
    "0802": { name: "AUTOMOBILE PARTS & ACCESSORIES", macro_tags: ["Local Car Production", "Raw Metal Costs", "Localization Policy"], desc: "Suppliers to auto assemblers; tied to local car manufacturing volumes." },
    "0803": { name: "CABLE & ELECTRICAL GOODS", macro_tags: ["Copper Prices", "Construction/Housing Demand", "Power Grid Projects"], desc: "Impacted by raw copper commodity prices and power grid upgrades." },
    "0804": { name: "CEMENT", macro_tags: ["Coal Prices", "Govt PSDP Budget", "Construction Demand", "Exports"], desc: "Driven by infrastructure spending and international coal freight costs." },
    "0805": { name: "CHEMICAL", macro_tags: ["Crude Oil Derivative Costs", "Tariff Protections", "Industrial Demand"], desc: "Producers of industrial chemicals, soda ash, and polymers." },
    "0806": { name: "CLOSE - END MUTUAL FUND", macro_tags: ["Equity Market Direction", "Discount to NAV"], desc: "Investment funds trading on exchange relative to their Net Asset Value." },
    "0807": { name: "COMMERCIAL BANKS", macro_tags: ["Policy Rate (SBP)", "KIBOR", "ADR Ratio", "Treasury Yields"], desc: "Sensitive to SBP monetary policy interest rates and treasury bond yields." },
    "0808": { name: "ENGINEERING", macro_tags: ["Steel Rebar Prices", "Scrap Iron Import Costs", "Infrastructure Demand"], desc: "Steel mills and heavy engineering fabricators." },
    "0809": { name: "FERTILIZER", macro_tags: ["Gas Subsidies", "Urea Offtake", "Crop Sowing Seasons", "High Dividends"], desc: "High dividend-yielding sector tied to agriculture cycles and feed gas pricing." },
    "0810": { name: "FOOD & PERSONAL CARE PRODUCTS", macro_tags: ["Consumer Inflation", "Agricultural Yields", "Dairy Prices"], desc: "Essential consumer staples; relatively defensive during recessions." },
    "0811": { name: "GLASS & CERAMICS", macro_tags: ["Gas Tariffs", "Real Estate Construction", "Import Competition"], desc: "Manufacturers of tiles, sanitary ware, and glass containers." },
    "0812": { name: "INSURANCE", macro_tags: ["Investment Yields", "Auto Sales", "Health/Life Claims"], desc: "General and Life insurance companies earning float income on premiums." },
    "0813": { name: "INV. BANKS / INV. COS. / SECURITIES COS.", macro_tags: ["PSX Daily Turnover", "IPO Activity", "Advisory Fees"], desc: "Brokerages and asset managers whose earnings grow with market trading volumes." },
    "0814": { name: "JUTE", macro_tags: ["Crop Bagging Demand", "Agricultural Storage"], desc: "Manufacturers of jute twine and sacking bags for grain packaging." },
    "0815": { name: "LEASING COMPANIES", macro_tags: ["KIBOR", "Corporate Capital Expenditure (Capex)"], desc: "Equipment and vehicle leasing entities." },
    "0816": { name: "LEATHER & TANNERIES", macro_tags: ["Export Rebates", "Global Fashion Demand", "Raw Hide Prices"], desc: "Export-oriented leather apparel and footwear tanneries." },
    "0818": { name: "MISCELLANEOUS", macro_tags: ["Industrial Diversification", "General Trading"], desc: "Diversified commercial and industrial holding companies." },
    "0819": { name: "MODARABAS", macro_tags: ["Islamic Finance Demand", "Shariah Lending Spreads"], desc: "Shariah-compliant Islamic leasing and financial entities." },
    "0820": { name: "OIL & GAS EXPLORATION COMPANIES", macro_tags: ["Brent Crude Oil", "Circular Debt Payouts", "USD/PKR Rate"], desc: "Driven by global oil benchmark prices and government circular debt cash flow." },
    "0821": { name: "OIL & GAS MARKETING COMPANIES", macro_tags: ["Petroleum Sales Volume", "Regulated OMC Margins", "Inventory Gains/Losses"], desc: "Retail fuel pump networks (PSO, Shell, Total, APL)." },
    "0822": { name: "PAPER, BOARD & PACKAGING", macro_tags: ["FMCG Packaging Demand", "Imported Pulp Costs"], desc: "Industrial packaging suppliers for food, pharma, and textile industries." },
    "0823": { name: "PHARMACEUTICALS", macro_tags: ["DRAP Price Deregulation", "API Import Costs", "Inflation"], desc: "Medicine manufacturers sensitive to pricing approvals and currency rates." },
    "0824": { name: "POWER GENERATION & DISTRIBUTION", macro_tags: ["Capacity Payments", "Circular Debt Inflows", "Fuel Cost Adjustments (FCA)"], desc: "Independent power producers (IPPs) offering high sovereign-backed dividend yields." },
    "0825": { name: "REFINERY", macro_tags: ["Gross Refinery Margins (GRMs)", "Crude Crack Spreads", "Brownfield Policy"], desc: "Refiners converting imported crude into petrol, diesel, and furnace oil." },
    "0826": { name: "SUGAR & ALLIED INDUSTRIES", macro_tags: ["Sugarcane Support Price", "Ethanol Exports", "Sugar Retail Price"], desc: "Seasonal sugar mills profiting from sugar and by-product ethanol exports." },
    "0827": { name: "SYNTHETIC & RAYON", macro_tags: ["Polyester Staple Fiber (PSF) Margins", "Purified Terephthalic Acid (PTA) Costs"], desc: "Synthetic fiber manufacturers for textile blending." },
    "0828": { name: "TECHNOLOGY & COMMUNICATION", macro_tags: ["USD / PKR Exchange Rate", "Global IT Spend", "Software Export Rebates"], desc: "Software exporters benefiting directly from USD appreciation." },
    "0829": { name: "TEXTILE COMPOSITE", macro_tags: ["Cotton Crop Prices", "Export Subsidies (DLTL)", "EU GSP+ Status", "Energy Tariffs"], desc: "Fully integrated spinners, weavers, and garment exporters." },
    "0830": { name: "TEXTILE SPINNING", macro_tags: ["Raw Cotton Prices", "Yarn Export Demand to China"], desc: "Pure yarn spinners sensitive to raw cotton harvest yields." },
    "0831": { name: "TEXTILE WEAVING", macro_tags: ["Grey Cloth Demand", "Power Costs"], desc: "Manufacturers of woven fabrics for export and local processing." },
    "0832": { name: "TOBACCO", macro_tags: ["Federal Excise Duties (FED)", "Illicit Trade Volumes"], desc: "Cigarette manufacturers sensitive to government excise taxes." },
    "0833": { name: "TRANSPORT", macro_tags: ["Port Container Volumes", "Freight Shipping Rates", "Aviation Fuel"], desc: "Shipping lines, logistics handlers, and airline operators." },
    "0834": { name: "VANASPATI & ALLIED INDUSTRIES", macro_tags: ["Palm Oil Import Prices", "Retail Edible Oil Prices"], desc: "Cooking oil and ghee manufacturers tied to Malaysian palm oil futures." },
    "0835": { name: "WOOLLEN", macro_tags: ["Winter Clothing Demand", "Raw Wool Costs"], desc: "Niche manufacturers of woolen fabrics and blankets." },
    "0836": { name: "REAL ESTATE INVESTMENT TRUST", macro_tags: ["Commercial Rental Yields", "Property Valuation Growth"], desc: "REIT funds distributing rental income from prime commercial real estate." },
    "0837": { name: "EXCHANGE TRADED FUNDS", macro_tags: ["Index Tracking", "Market Liquidity"], desc: "Basket funds tracking top PSX blue-chips or banking sectors." },
    "0838": { name: "PROPERTY", macro_tags: ["Real Estate Transactions", "FBR Tax Rates on Plots"], desc: "Commercial and residential real estate developers." },
    "0839": { name: "APPAREL", macro_tags: ["Fast Fashion Export Orders", "Value-Added Knitwear Demand"], desc: "High-margin garment and knitwear exporters to US/European brands." },
});

// Simple code-to-name lookup map
const PSX_SECTORS = Object.freeze(
    Object.fromEntries(Object.entries(PSX_SECTORS_DATA).map(([code, data]) => [code, data.name]))
);

/**
 * Returns human-readable sector name for a given code
 * @param {string} code - Sector code (e.g., "0804")
 */
const getSectorName = (code) => PSX_SECTORS[String(code)] || 'MISCELLANEOUS';

/**
 * Returns complete sector data including macro drivers and description
 * @param {string} code - Sector code (e.g., "0804")
 */
const getSectorData = (code) => PSX_SECTORS_DATA[String(code)] || null;

module.exports = {
    PSX_SECTORS_DATA,
    PSX_SECTORS,
    getSectorName,
    getSectorData,
};