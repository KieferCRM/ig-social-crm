"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { DealType } from "@/lib/deals";
import { parsePositiveDecimal } from "@/lib/deal-metrics";

type ConvertToDealButtonProps = {
  leadId: string;
  defaultPropertyAddress?: string | null;
};

export default function ConvertToDealButton({
  leadId,
  defaultPropertyAddress,
}: ConvertToDealButtonProps) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [createdDealId, setCreatedDealId] = useState<string | null>(null);

  const [propertyAddress, setPropertyAddress] = useState(defaultPropertyAddress || "");
  const [dealType, setDealType] = useState<DealType>("buyer");
  const [price, setPrice] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function openModal() {
    setStatus("");
    setCreatedDealId(null);
    setPropertyAddress(defaultPropertyAddress || "");
    setDealType("buyer");
    setPrice("");
    setExpectedCloseDate("");
    setOpen(true);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = propertyAddress.trim();
    if (!address) {
      toast.error("Property address is required.");
      return;
    }

    const parsedPrice = parsePositiveDecimal(price);
    if (price.trim() && parsedPrice === null) {
      toast.error("Price must be a valid positive number.");
      return;
    }

    setSaving(true);
    setStatus("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSaving(false);
      toast.error("You need to be signed in to create a deal.");
      return;
    }

    const payload = {
      agent_id: user.id,
      lead_id: leadId,
      property_address: address,
      deal_type: dealType,
      price: parsedPrice,
      stage: "new",
      expected_close_date: expectedCloseDate.trim() || null,
    };

    const { data, error } = await supabase
      .from("deals")
      .insert(payload)
      .select("id")
      .single();

    setSaving(false);

    if (error || !data?.id) {
      toast.error(error?.message || "Could not create deal.");
      return;
    }

    setCreatedDealId(String(data.id));
    toast.success("Deal created.");
  }

  return (
    <>
      <button type="button" className="crm-btn crm-btn-primary" onClick={openModal}>
        Convert to Deal
      </button>

      {open ? (
        <div
          className="crm-lead-command-modal-overlay"
          onClick={() => setOpen(false)}
        >
          <section
            className="crm-lead-command-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="crm-section-head">
              <h2 className="crm-section-title">Convert to Deal</h2>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                style={{ padding: "6px 8px", fontSize: 12 }}
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <form
              onSubmit={(event) => void onSubmit(event)}
              className="crm-lead-command-modal-form"
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Property Address</span>
                <input
                  value={propertyAddress}
                  onChange={(event) => setPropertyAddress(event.target.value)}
                  placeholder="123 Main St, Austin TX"
                  required
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Deal Type</span>
                <select
                  value={dealType}
                  onChange={(event) => setDealType(event.target.value as DealType)}
                >
                  <option value="buyer">Buyer</option>
                  <option value="listing">Listing</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Price</span>
                <input
                  inputMode="decimal"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="450000"
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Expected Close Date</span>
                <input
                  type="date"
                  value={expectedCloseDate}
                  onChange={(event) => setExpectedCloseDate(event.target.value)}
                />
              </label>

              <div className="crm-lead-command-modal-footer">
                <div style={{ fontSize: 12, color: status ? "var(--foreground)" : "var(--ink-muted)" }}>
                  {status || "Stage will start at New."}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {createdDealId ? (
                    <Link href="/app/deals" className="crm-btn crm-btn-secondary" style={{ padding: "8px 10px", fontSize: 12 }}>
                      Open Deals
                    </Link>
                  ) : null}
                  <button type="submit" className="crm-btn crm-btn-primary" style={{ padding: "8px 10px", fontSize: 12 }} disabled={saving}>
                    {saving ? "Creating..." : "Create Deal"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
