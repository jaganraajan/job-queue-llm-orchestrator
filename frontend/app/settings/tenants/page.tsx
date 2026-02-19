"use client";

import { useState } from "react";
import { useMockSystem } from "@/lib/mock-store";

export default function TenantSettingsPage() {
  const { state, updateTenantLimit } = useMockSystem();
  const [savedTenant, setSavedTenant] = useState<string | null>(null);

  return (
    <section className="page">
      <div className="page-title">
        <h2>Tenant Limits</h2>
      </div>

      <div className="cards">
        {state.tenantLimits.map((tenant) => (
          <article key={tenant.tenantId} className="panel">
            <h3>{tenant.tenantId}</h3>
            <form
              className="tenant-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                updateTenantLimit({
                  tenantId: tenant.tenantId,
                  concurrency: Number(form.get("concurrency")),
                  rps: Number(form.get("rps")),
                  tokenBudgetPerMin: Number(form.get("tokenBudgetPerMin"))
                });
                setSavedTenant(tenant.tenantId);
              }}
            >
              <label>
                Concurrency
                <input name="concurrency" type="number" min={1} defaultValue={tenant.concurrency} />
              </label>
              <label>
                Requests / sec
                <input name="rps" type="number" min={1} defaultValue={tenant.rps} />
              </label>
              <label>
                Token budget / min
                <input
                  name="tokenBudgetPerMin"
                  type="number"
                  min={1000}
                  step={1000}
                  defaultValue={tenant.tokenBudgetPerMin}
                />
              </label>
              <button type="submit">Save Limits</button>
            </form>
            {savedTenant === tenant.tenantId && <p className="hint">Saved in mock state.</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
