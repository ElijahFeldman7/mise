"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { guessTotal } from "@/lib/ocr";
import type { ReceiptLine } from "@/lib/types";

export type ReceiptDecision = {
  raw: string;
  parsedName: string;
  price: number | null;
  quantity: number | null;
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
  location?: string | null;
  phone?: string | null;
  purchasedOn: string | null;
  rawText: string;
  imagePath?: string | null;
  decisions: ReceiptDecision[];
}) {
  const session = await requireSession();
  const supabase = await createClient();

  const accepted = input.decisions.filter((d) => d.accepted && d.itemId);
  const { total, tax, currency } = guessTotal(input.rawText);

  const { data: receipt, error } = await supabase
    .from("receipts")
    .insert({
      household_id: session.household.id,
      uploaded_by: session.userId,
      image_path: input.imagePath ?? null,
      store: input.store,
      location: input.location ?? null,
      phone: input.phone ?? null,
      purchased_on: input.purchasedOn,
      raw_text: input.rawText.slice(0, 20000),
      line_count: input.decisions.length,
      matched_count: accepted.length,
      total,
      tax,
      currency,
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
        quantity: decision.quantity,
        matched_item_id: decision.accepted ? decision.itemId : null,
        confidence: decision.confidence,
        status: statusFor(decision),
      })),
    );
  }

  if (accepted.length) {
    const now = new Date().toISOString();
    const ids = accepted.map((d) => d.itemId as string);

    const { data: bought } = await supabase
      .from("grocery_items")
      .update({
        checked: true,
        checked_at: now,
        checked_by: session.userId,
        checked_via: "receipt",
      })
      .in("id", ids)
      .select("id, item_key");

    // Buying it fills the cupboard back up.
    const keyById = new Map((bought ?? []).map((row) => [row.id as string, row.item_key as string]));
    const keys = [...new Set(keyById.values())];

    if (keys.length) {
      await supabase
        .from("pantry_items")
        .update({ status: "have", used_since_buy: 0, updated_at: now })
        .eq("household_id", session.household.id)
        .in("item_key", keys);

      // When the receipt line named a quantity, carry it onto the cupboard too.
      const quantityByKey = new Map<string, number>();
      for (const decision of accepted) {
        const key = keyById.get(decision.itemId as string);
        if (key && decision.quantity) quantityByKey.set(key, decision.quantity);
      }

      for (const [key, quantity] of quantityByKey) {
        await supabase
          .from("pantry_items")
          .update({ quantity })
          .eq("household_id", session.household.id)
          .eq("item_key", key);
      }
    }
  }

  revalidatePath("/list");
  revalidatePath("/list/cupboard");
  revalidatePath("/list/receipts");
  return { ok: true, checked: accepted.length, receiptId: receipt.id as string };
}

export async function deleteReceipt(id: string) {
  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from("receipts")
    .delete()
    .eq("id", id)
    .eq("household_id", session.household.id);

  if (error) return { error: error.message };

  revalidatePath("/list/receipts");
  return { ok: true };
}
