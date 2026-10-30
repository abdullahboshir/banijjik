import type { LocalizedText } from "@banijjik/contracts";
import type { OfferingKind } from "@banijjik/contracts/catalog";
import type { Money } from "@banijjik/contracts/pricing";
import type {
  CheckoutFulfillment,
  CheckoutSelection,
  PublicQuoteResponse,
  PublicSelection,
} from "@banijjik/contracts/website";
import { newId } from "@banijjik/ids";

export interface CartItemDisplayInfo {
  readonly offeringName: LocalizedText;
  readonly variantName: LocalizedText;
  readonly unitPrice: Money;
  readonly mediaUrl: string | null;
  readonly kind: OfferingKind;
}

export interface CartLine {
  readonly selectionId: string;
  readonly selection: PublicSelection;
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly display: CartItemDisplayInfo;
}

export interface CartState {
  readonly locationId: string | null;
  readonly items: readonly CartLine[];
  readonly fulfillment: CheckoutFulfillment;
  readonly quote: PublicQuoteResponse | null;
  readonly idempotencyKey: string | null;
}

const STORAGE_KEY = "sf_cart_state_v1";

const DEFAULT_FULFILLMENT: CheckoutFulfillment = { method: "PICKUP" };

const INITIAL_STATE: CartState = {
  locationId: null,
  items: [],
  fulfillment: DEFAULT_FULFILLMENT,
  quote: null,
  idempotencyKey: null,
};

function parseStoredState(serialized: string | null): CartState | null {
  if (!serialized) return null;
  try {
    const parsed = JSON.parse(serialized) as CartState;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return {
      locationId: parsed.locationId ?? null,
      items: parsed.items,
      fulfillment: parsed.fulfillment ?? DEFAULT_FULFILLMENT,
      quote: parsed.quote ?? null,
      idempotencyKey: parsed.idempotencyKey ?? null,
    };
  } catch {
    return null;
  }
}

type Listener = () => void;

class CartStore {
  private state: CartState = INITIAL_STATE;
  private listeners: Set<Listener> = new Set();
  private isLoaded = false;

  constructor() {
    this.load();
  }

  private load(): void {
    if (typeof window === "undefined" || this.isLoaded) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = parseStoredState(raw);
      if (parsed) this.state = parsed;
    } catch {
      // Storage access blocked
    }
    this.isLoaded = true;
  }

  private persistAndNotify(): void {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        // Storage quota exceeded or disabled
      }
    }
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getState(): CartState {
    this.load();
    return this.state;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Single-location guard:
   * Returns { ok: true } on success, or { ok: false, reason: "LOCATION_MISMATCH" }
   */
  public addItem(input: {
    readonly locationId: string;
    readonly selection: PublicSelection;
    readonly customFields?: Readonly<Record<string, unknown>>;
    readonly display: CartItemDisplayInfo;
  }): { readonly ok: boolean; readonly reason?: "LOCATION_MISMATCH" } {
    this.load();

    // If cart has items and location differs, reject to enforce single-location rule
    if (
      this.state.items.length > 0 &&
      this.state.locationId !== null &&
      this.state.locationId !== input.locationId
    ) {
      return { ok: false, reason: "LOCATION_MISMATCH" };
    }

    const selectionId = newId();
    const newItem: CartLine = {
      selectionId,
      selection: input.selection,
      customFields: input.customFields ?? {},
      display: input.display,
    };

    // Check if duplicate item can be merged (e.g. PRODUCT with same variant and modifierOptionIds)
    let merged = false;
    const updatedItems = this.state.items.map((item) => {
      if (
        item.selection.kind === "PRODUCT" &&
        input.selection.kind === "PRODUCT" &&
        item.selection.offeringId === input.selection.offeringId &&
        item.selection.variantId === input.selection.variantId &&
        JSON.stringify(item.selection.modifierOptionIds) ===
          JSON.stringify(input.selection.modifierOptionIds) &&
        JSON.stringify(item.customFields) === JSON.stringify(input.customFields ?? {})
      ) {
        merged = true;
        return {
          ...item,
          selection: {
            ...item.selection,
            quantity: item.selection.quantity + input.selection.quantity,
          },
        };
      }
      return item;
    });

    this.state = {
      ...this.state,
      locationId: input.locationId,
      items: merged ? updatedItems : [...this.state.items, newItem],
      quote: null, // Cart mutated -> invalidate quote
      idempotencyKey: null, // Invalidate idempotency key
    };

    this.persistAndNotify();
    return { ok: true };
  }

  /**
   * Forcefully reset cart to new location and add item.
   */
  public switchLocationAndAdd(input: {
    readonly locationId: string;
    readonly selection: PublicSelection;
    readonly customFields?: Readonly<Record<string, unknown>>;
    readonly display: CartItemDisplayInfo;
  }): void {
    this.clear();
    this.addItem(input);
  }

  public removeItem(selectionId: string): void {
    this.load();
    const items = this.state.items.filter((item) => item.selectionId !== selectionId);
    this.state = {
      ...this.state,
      locationId: items.length === 0 ? null : this.state.locationId,
      items,
      quote: null,
      idempotencyKey: null,
    };
    this.persistAndNotify();
  }

  public updateQuantity(selectionId: string, quantity: number): void {
    this.load();
    if (quantity <= 0) {
      this.removeItem(selectionId);
      return;
    }

    this.state = {
      ...this.state,
      items: this.state.items.map((item) => {
        if (item.selectionId !== selectionId) return item;
        if ("quantity" in item.selection) {
          return {
            ...item,
            selection: { ...item.selection, quantity },
          };
        }
        return item;
      }),
      quote: null,
      idempotencyKey: null,
    };
    this.persistAndNotify();
  }

  public setFulfillment(fulfillment: CheckoutFulfillment): void {
    this.load();
    this.state = {
      ...this.state,
      fulfillment,
      quote: null,
      idempotencyKey: null,
    };
    this.persistAndNotify();
  }

  public setQuote(quote: PublicQuoteResponse | null): void {
    this.load();
    this.state = {
      ...this.state,
      quote,
    };
    this.persistAndNotify();
  }

  /**
   * Returns the stable Idempotency-Key for the current submission attempt,
   * or creates one if not present. The key remains stable across network retries
   * until cart mutations occur or explicit reset.
   */
  public getOrGenerateIdempotencyKey(): string {
    this.load();
    if (this.state.idempotencyKey) {
      return this.state.idempotencyKey;
    }
    const newKey = newId();
    this.state = {
      ...this.state,
      idempotencyKey: newKey,
    };
    this.persistAndNotify();
    return newKey;
  }

  public resetIdempotencyKey(): string {
    this.load();
    const newKey = newId();
    this.state = {
      ...this.state,
      idempotencyKey: newKey,
    };
    this.persistAndNotify();
    return newKey;
  }

  public clear(): void {
    this.state = INITIAL_STATE;
    this.persistAndNotify();
  }

  /** Convert cart lines into API CheckoutSelection items */
  public getCheckoutSelections(): readonly CheckoutSelection[] {
    this.load();
    return this.state.items.map((line) => ({
      selectionId: line.selectionId,
      selection: line.selection,
      customFields: line.customFields,
    }));
  }
}

export const cartStore = new CartStore();
