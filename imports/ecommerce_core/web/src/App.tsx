import { useMemo, useRef, useState } from "react";
import {
  CoverageLaneResponse,
  createFusionServiceAdapters,
  createOmniRouteClient,
  mapFusionOrderToPolicyRequest,
  PolicyCheckResponse,
} from "@fusioncommerce/omniroute-sdk";

type ActionName = "sdkPolicy" | "servicePolicy" | "createOrder" | "lanePreview";

type CheckoutLine = {
  sku: string;
  category: string;
  quantity: number;
  price: number;
};

type CheckoutFormState = {
  tenantId: string;
  customerId: string;
  brandId: string;
  destinationState: string;
  currency: string;
  lines: CheckoutLine[];
};

const initialLines: CheckoutLine[] = [
  { sku: "IND-CHK-40", category: "Noodles", quantity: 10, price: 5500 },
  { sku: "PM-400-CTN", category: "Dairy", quantity: 8, price: 2800 },
];

const initialFormState: CheckoutFormState = {
  tenantId: "tenant_acme_001",
  customerId: "customer-123",
  brandId: "indomie",
  destinationState: "Lagos",
  currency: "USD",
  lines: initialLines,
};

const orderServiceUrl = import.meta.env.VITE_ORDERS_SERVICE_URL || "http://localhost:3001";
const shippingServiceUrl = import.meta.env.VITE_SHIPPING_SERVICE_URL || "http://localhost:3005";
const omnirouteBaseUrl = import.meta.env.VITE_OMNIROUTE_API_BASE_URL || "";
const omniroutePublicKey = import.meta.env.VITE_OMNIROUTE_PUBLIC_KEY || "";
const omnirouteTenantId = import.meta.env.VITE_OMNIROUTE_TENANT_ID || "";

const toNumber = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const statusTagClass = (isPositive: boolean): string =>
  isPositive ? "status-tag status-tag--ok" : "status-tag status-tag--warn";

export default function App() {
  const [formState, setFormState] = useState<CheckoutFormState>(initialFormState);
  const [sdkPreview, setSdkPreview] = useState<PolicyCheckResponse | null>(null);
  const [servicePreview, setServicePreview] = useState<PolicyCheckResponse | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Record<string, unknown> | null>(null);
  const [lanePreview, setLanePreview] = useState<CoverageLaneResponse[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActionName | null>(null);
  const actionLock = useRef(false);

  const serviceAdapters = useMemo(
    () =>
      createFusionServiceAdapters({
        ordersServiceUrl: orderServiceUrl,
        shippingServiceUrl: shippingServiceUrl,
      }),
    [],
  );

  const normalizeLines = useMemo(
    () => (input: CheckoutLine[]) =>
      input.map((line) => ({
        sku: line.sku.trim(),
        category: line.category.trim(),
        quantity: Number(line.quantity),
        price: Number(line.price),
      })),
    [],
  );

  const normalizedLines = useMemo(() => normalizeLines(formState.lines), [formState.lines, normalizeLines]);

  const basketTotal = useMemo(
    () => normalizedLines.reduce((sum, line) => sum + line.quantity * line.price, 0),
    [normalizedLines],
  );

  const updateField = <K extends keyof CheckoutFormState>(key: K, value: CheckoutFormState[K]) => {
    setFormState((previous) => ({ ...previous, [key]: value }));
  };

  const updateLine = (index: number, key: keyof CheckoutLine, value: string) => {
    setFormState((previous) => {
      const nextLines = [...previous.lines];
      const nextLine = { ...nextLines[index] };

      if (key === "quantity" || key === "price") {
        nextLine[key] = toNumber(value);
      } else {
        nextLine[key] = value;
      }

      nextLines[index] = nextLine;
      return { ...previous, lines: nextLines };
    });
  };

  const addLine = () => {
    setFormState((previous) => ({
      ...previous,
      lines: [...previous.lines, { sku: "", category: "", quantity: 1, price: 0 }],
    }));
  };

  const removeLine = (index: number) => {
    setFormState((previous) => {
      if (previous.lines.length === 1) {
        return previous;
      }

      const nextLines = previous.lines.filter((_, lineIndex) => lineIndex !== index);
      return { ...previous, lines: nextLines };
    });
  };

  const validateBaseFields = (): string | null => {
    if (!formState.brandId.trim()) return "Brand is required.";
    if (!formState.destinationState.trim()) return "Destination state is required.";
    if (normalizedLines.length === 0) return "At least one line item is required.";

    const hasInvalidLine = normalizedLines.some(
      (line) => !line.sku || !line.category || line.quantity < 1 || line.price < 0,
    );

    if (hasInvalidLine) {
      return "Each line item must have SKU, category, quantity >= 1 and price >= 0.";
    }

    return null;
  };

  const createTenantAwareSdkClient = (tenantId?: string) => {
    if (!omnirouteBaseUrl || !omniroutePublicKey) {
      return null;
    }

    return createOmniRouteClient({
      baseUrl: omnirouteBaseUrl,
      apiKey: omniroutePublicKey,
      tenantId: tenantId || omnirouteTenantId || undefined,
    });
  };

  const runAction = async (action: ActionName, handler: () => Promise<void>) => {
    if (actionLock.current) {
      return;
    }

    actionLock.current = true;
    setActiveAction(action);
    setErrorMessage(null);

    try {
      await handler();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
    } finally {
      actionLock.current = false;
      setActiveAction(null);
    }
  };

  const evaluateWithSdk = async () => {
    await runAction("sdkPolicy", async () => {
      const validationError = validateBaseFields();
      if (validationError) {
        throw new Error(validationError);
      }

      const sdkClient = createTenantAwareSdkClient(formState.tenantId);
      if (!sdkClient) {
        throw new Error("Set VITE_OMNIROUTE_API_BASE_URL and VITE_OMNIROUTE_PUBLIC_KEY to use direct SDK preview.");
      }

      const result = await sdkClient.evaluateCheckoutPolicy(
        mapFusionOrderToPolicyRequest({
          brandId: formState.brandId.trim(),
          destinationState: formState.destinationState.trim(),
          items: normalizedLines.map((line) => ({
            sku: line.sku,
            category: line.category,
            quantity: line.quantity,
          })),
        }),
      );

      setSdkPreview(result);
    });
  };

  const evaluateViaOrdersService = async () => {
    await runAction("servicePolicy", async () => {
      const validationError = validateBaseFields();
      if (validationError) {
        throw new Error(validationError);
      }

      const payload = await serviceAdapters.previewPolicy({
        tenantId: formState.tenantId.trim() || undefined,
        brandId: formState.brandId.trim(),
        destinationState: formState.destinationState.trim(),
        items: normalizedLines.map((line) => ({
          sku: line.sku,
          category: line.category,
          quantity: line.quantity,
        })),
      });

      setServicePreview(payload);
    });
  };

  const createOrder = async () => {
    await runAction("createOrder", async () => {
      const validationError = validateBaseFields();
      if (validationError) {
        throw new Error(validationError);
      }

      if (!formState.customerId.trim()) {
        throw new Error("Customer ID is required.");
      }

      const order = await serviceAdapters.createOrder({
        customerId: formState.customerId.trim(),
        tenantId: formState.tenantId.trim() || undefined,
        brandId: formState.brandId.trim(),
        destinationState: formState.destinationState.trim(),
        currency: formState.currency.trim() || "USD",
        items: normalizedLines,
      });

      setCreatedOrder(order);
    });
  };

  const previewShippingLanes = async () => {
    await runAction("lanePreview", async () => {
      if (!formState.destinationState.trim()) {
        throw new Error("Destination state is required.");
      }

      const lanes = await serviceAdapters.previewShippingLanes(formState.destinationState.trim());
      setLanePreview(lanes);
    });
  };

  return (
    <div className="app-shell">
      <header className="hero-card">
        <h1>FusionCommerce x OmniRoute Checkout Orchestration</h1>
        <p>Frontend now exercises the same OmniRoute SDK directly and through service-backed endpoints for production-safe flows.</p>
      </header>

      {errorMessage && (
        <section className="alert-card" role="alert">
          <strong>Request failed</strong>
          <p>{errorMessage}</p>
        </section>
      )}

      <section className="panel-card">
        <h2>Checkout Context</h2>
        <div className="form-grid">
          <label>
            <span>Tenant ID</span>
            <input
              value={formState.tenantId}
              onChange={(event) => updateField("tenantId", event.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Customer ID</span>
            <input
              value={formState.customerId}
              onChange={(event) => updateField("customerId", event.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Brand</span>
            <input value={formState.brandId} onChange={(event) => updateField("brandId", event.target.value)} autoComplete="off" />
          </label>
          <label>
            <span>Destination State</span>
            <input
              value={formState.destinationState}
              onChange={(event) => updateField("destinationState", event.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Currency</span>
            <input value={formState.currency} onChange={(event) => updateField("currency", event.target.value)} autoComplete="off" />
          </label>
        </div>

        <div className="line-items-header">
          <h3>Line Items</h3>
          <button type="button" className="secondary-btn" onClick={addLine}>
            + Add Line
          </button>
        </div>

        <div className="line-items-list">
          {formState.lines.map((line, index) => (
            <div className="line-item-row" key={`${line.sku}-${line.category}-${index}`}>
              <label>
                <span>SKU</span>
                <input value={line.sku} onChange={(event) => updateLine(index, "sku", event.target.value)} autoComplete="off" />
              </label>
              <label>
                <span>Category</span>
                <input value={line.category} onChange={(event) => updateLine(index, "category", event.target.value)} autoComplete="off" />
              </label>
              <label>
                <span>Quantity</span>
                <input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(event) => updateLine(index, "quantity", event.target.value)}
                />
              </label>
              <label>
                <span>Price</span>
                <input
                  type="number"
                  min={0}
                  value={line.price}
                  onChange={(event) => updateLine(index, "price", event.target.value)}
                />
              </label>
              <button
                type="button"
                className="danger-btn"
                onClick={() => removeLine(index)}
                disabled={formState.lines.length === 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="action-row">
          <button type="button" onClick={evaluateWithSdk} disabled={Boolean(activeAction)}>
            {activeAction === "sdkPolicy" ? "Running..." : "Direct SDK Policy Preview"}
          </button>
          <button type="button" onClick={evaluateViaOrdersService} disabled={Boolean(activeAction)}>
            {activeAction === "servicePolicy" ? "Running..." : "Orders Service Policy Preview"}
          </button>
          <button type="button" onClick={createOrder} disabled={Boolean(activeAction)}>
            {activeAction === "createOrder" ? "Running..." : "Create Order (Policy-Aware)"}
          </button>
          <button type="button" onClick={previewShippingLanes} disabled={Boolean(activeAction)}>
            {activeAction === "lanePreview" ? "Running..." : "Shipping Lane Preview"}
          </button>
        </div>
      </section>

      <section className="result-grid">
        <article className="panel-card">
          <div className="panel-heading">
            <h2>Direct SDK Output</h2>
            <span className={statusTagClass(sdkPreview?.compliant ?? false)}>
              {sdkPreview ? (sdkPreview.compliant ? "COMPLIANT" : "AUTO-GROUP") : "IDLE"}
            </span>
          </div>
          {sdkPreview ? (
            <div>
              <p className="inline-detail">
                <strong>Lane:</strong> {sdkPreview.coverageLane}
              </p>
              <p className="inline-detail">
                <strong>SLA:</strong> {sdkPreview.expectedSlaHours}h
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Qty</th>
                      <th>MOQ</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sdkPreview.checks.map((check) => (
                      <tr key={check.category}>
                        <td>{check.category}</td>
                        <td className="numeric">{check.quantity}</td>
                        <td className="numeric">{check.requiredMOQ}</td>
                        <td>
                          <span className={statusTagClass(check.compliant)}>{check.compliant ? "OK" : "GAP"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="muted-text">No direct SDK evaluation yet.</p>
          )}
        </article>

        <article className="panel-card">
          <h2>Service-Orchestrated Output</h2>
          {servicePreview ? (
            <div>
              <p className="inline-detail">
                <strong>Lane:</strong> {servicePreview.coverageLane}
              </p>
              <p className="inline-detail">
                <strong>SLA:</strong> {servicePreview.expectedSlaHours}h
              </p>
            </div>
          ) : (
            <p className="muted-text">No service policy preview yet.</p>
          )}

          <hr />

          <h3>Latest Order</h3>
          {createdOrder ? (
            <pre className="json-preview">{JSON.stringify(createdOrder, null, 2)}</pre>
          ) : (
            <p className="muted-text">No order created in this session.</p>
          )}

          <hr />

          <h3>Shipping Lanes</h3>
          {lanePreview.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Lane</th>
                    <th>Owner</th>
                    <th>Type</th>
                    <th>SLA (h)</th>
                  </tr>
                </thead>
                <tbody>
                  {lanePreview.map((lane) => (
                    <tr key={lane.laneId}>
                      <td>{lane.laneId}</td>
                      <td>{lane.owner}</td>
                      <td>{lane.ownerType}</td>
                      <td className="numeric">{lane.slaHours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-text">No shipping lane preview yet.</p>
          )}
        </article>
      </section>

      <section className="panel-card">
        <h2>Current Checkout Basket</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Category</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {normalizedLines.map((line, index) => (
                <tr key={`${line.sku}-${line.category}-${index}`}>
                  <td>{line.sku}</td>
                  <td>{line.category}</td>
                  <td className="numeric">{line.quantity}</td>
                  <td className="numeric">{line.price}</td>
                  <td className="numeric">{line.quantity * line.price}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={4}>Basket Total</th>
                <th className="numeric">{basketTotal}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
