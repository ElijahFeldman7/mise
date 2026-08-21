"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { ReceiptLine } from "@/lib/types";

export type ReceiptDecision = {
  raw: string;
  parsedName: string;
  price: number | null;
  itemId: string | null;
  confidence: number;
  accepted: boolean;
};

function statusFor(decision: ReceiptDecision): ReceiptLine["status"] {
  if (!decision.itemId) return "unmatched";
  if (!decision.accepted) return "rejected";
  return decision.confidence >= 0.72 ? "auto" : "confirmed";
}

export async function applyReceipt(input: {
  store: string | null;
  purchasedOn: string | null;
  rawText: string;
  imagePath?: string | null;
  decisions: ReceiptDecision[];
}) {
  const session = await requireSession();
  const supabase = await createClient();

  const accepted = input.decisions.filter((d) => d.accepted && d.itemId);

  const { data: receipt, error } = await supabase
    .from("receipts")
    .insert({
      household_id: session.household.id,
      uploaded_by: session.userId,
      image_path: input.imagePath ?? null,
      store: input.store,
      purchased_on: input.purchasedOn,
      raw_text: input.rawText.slice(0, 20000),
      line_count: input.decisions.length,
      matched_count: accepted.length,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (input.decisions.length) {
    await supabase.from("receipt_lines").insert(
      input.decisions.map((decision) => ({
        receipt_id: receipt.id,
        raw_line: decision.raw,
        parsed_name: decision.parsedName,
        price: decision.price,
        matched_item_id: decision.accepted ? decision.itemId : null,
        confidence: decision.confidence,
        status: statusFor(decision),
      })),
    );
  }

  if (accepted.length) {
    const now = new Date().toISOString();
    await supabase
      .from("grocery_items")
      .update({
        checked: true,
        checked_at: now,
        checked_by: session.userId,
        checked_via: "receipt",
      })
      .in("id", accepted.map((d) => d.itemId as string));
  }

  revalidatePath("/list");
  return { ok: true, checked: accepted.length, receiptId: receipt.id as string };
}
