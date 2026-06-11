/**
 * Sonuswealth Engine - Macro-Economic Data Sync
 * Path: scripts/sync-macro-data.js
 */

const SUPABASE_URL = 'https://yknnfglfbpcyxcllrvmd.supabase.co';
// Key comes from the environment — NEVER hardcode it (service_role bypasses RLS).
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!SUPABASE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY in your environment (never hardcode it).'); process.exit(1); }

const ukMacroTimeline = [
    { year: 2021, cpi_inflation: 2.6, boe_base_rate: 0.10, gdp_growth: 7.6, ftse_return: 14.3, personal_allowance: 12570 },
    { year: 2022, cpi_inflation: 9.1, boe_base_rate: 3.50, gdp_growth: 4.1, ftse_return: 0.9, personal_allowance: 12570 },
    { year: 2023, cpi_inflation: 7.3, boe_base_rate: 5.25, gdp_growth: 0.1, ftse_return: 3.8, personal_allowance: 12570 },
    { year: 2024, cpi_inflation: 2.5, boe_base_rate: 5.25, gdp_growth: 0.8, ftse_return: 5.2, personal_allowance: 12570 },
    { year: 2025, cpi_inflation: 2.0, boe_base_rate: 4.50, gdp_growth: 1.5, ftse_return: 6.0, personal_allowance: 12570 },
    { year: 2026, cpi_inflation: 2.0, boe_base_rate: 4.00, gdp_growth: 1.6, ftse_return: 6.0, personal_allowance: 12570 }
];

async function syncMacroDataToSupabase() {
    console.log("Starting Macro-Economic Data Sync (2021-2026)...");

    for (const record of ukMacroTimeline) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/macro_economic_data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(record)
            });

            if (!response.ok) {
                const err = await response.text();
                console.error(`[X] Failed to sync year ${record.year}: ${err}`);
            } else {
                console.log(`[✓] Year ${record.year} synced successfully.`);
            }
        } catch (error) {
            console.error(`[X] Network error syncing year ${record.year}:`, error.message);
        }
    }
    console.log("Sync complete.");
}

syncMacroDataToSupabase();