#!/usr/bin/env npx tsx
/**
 * Batch invoice PDF generator.
 *
 * Usage:
 *   npx tsx scripts/generate-invoices.ts [options]
 *
 * Options:
 *   --account <number>   Generate invoice for a single account number
 *   --output <dir>       Output directory (default: ./invoices)
 *   --url <url>          Supabase URL (default: http://127.0.0.1:54321)
 *   --key <key>          Supabase service role key (or set SUPABASE_SERVICE_KEY env var)
 */

import { renderToFile } from "@react-pdf/renderer";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import React from "react";

import { InvoiceDocument } from "../src/components/atomic-crm/invoices/InvoiceDocument.js";
import {
  fetchAllInvoiceData,
  fetchInvoiceData,
} from "../src/components/atomic-crm/invoices/fetchInvoiceData.js";

// --- Parse CLI args ---
const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

const accountNumber = getArg("account");
const outputDir = getArg("output") ?? "./invoices";
const supabaseUrl =
  getArg("url") ??
  process.env.SUPABASE_URL ??
  "http://127.0.0.1:54321";
const supabaseKey =
  getArg("key") ??
  process.env.SUPABASE_SERVICE_KEY ??
  // Fallback to local dev service role key
  "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";

// --- Setup ---
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Ensure output directory exists
fs.mkdirSync(outputDir, { recursive: true });

const yearMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

async function generateOne(accountId: number, acctNum: string) {
  const data = await fetchInvoiceData(supabase, accountId);
  const filename = `invoice-${acctNum}-${yearMonth}.pdf`;
  const filepath = path.join(outputDir, filename);

  await renderToFile(
    React.createElement(InvoiceDocument, { data }),
    filepath,
  );

  console.log(`  Generated: ${filepath}`);
}

async function main() {
  console.log(`Invoice generator — ${new Date().toISOString()}`);
  console.log(`Supabase: ${supabaseUrl}`);
  console.log(`Output: ${outputDir}\n`);

  if (accountNumber) {
    // Single account mode
    const { data: account, error } = await supabase
      .from("accounts_summary")
      .select("id, account_number")
      .eq("account_number", accountNumber)
      .single();

    if (error || !account) {
      console.error(`Account ${accountNumber} not found: ${error?.message}`);
      process.exit(1);
    }

    console.log(`Generating invoice for account ${accountNumber}...`);
    await generateOne(account.id, account.account_number);
  } else {
    // Batch mode: all accounts with balance > 0
    console.log("Fetching accounts with outstanding balance...");
    const invoices = await fetchAllInvoiceData(supabase);

    if (invoices.length === 0) {
      console.log("No accounts with outstanding balance.");
      return;
    }

    console.log(`Generating ${invoices.length} invoice(s)...\n`);
    for (const { data } of invoices) {
      const filename = `invoice-${data.accountNumber}-${yearMonth}.pdf`;
      const filepath = path.join(outputDir, filename);

      await renderToFile(
        React.createElement(InvoiceDocument, { data }),
        filepath,
      );

      console.log(`  Generated: ${filepath}`);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
