// Types for the Product Variant system

export type OptionType = "select" | "color_swatch" | "image_swatch" | "text";

export interface ProductOptionValue {
  id: number;
  product_option_id: number;
  value: string;
  label: string | null;
  color_hex: string | null;
  image_url: string | null;
  position: number;
}

export interface ProductOption {
  id: number;
  product_id: number;
  name: string;
  display_name: string | null;
  type: OptionType;
  position: number;
  is_required: boolean;
  values: ProductOptionValue[];
}

export interface VariantOptionSummary {
  option_value_id: number;
  option_id: number;
  option_name: string;
  option_type: OptionType;
  value: string;
  label: string | null;
  color_hex: string | null;
  image_url: string | null;
}

export interface ProductVariant {
  id: number;
  sku: string;
  regular_price: string;
  discount: string;
  discount_type: "amount" | "percent";
  selling_price: string;
  cost_price: string;
  stock_qty: number;
  low_stock_threshold: number;
  weight: string | null;
  image_url: string | null;
  is_active: boolean;
  is_low_stock: boolean;
  position: number;
  options: VariantOptionSummary[];
}

export interface GenerateVariantsPayload {
  sku_prefix?: string;
  default_price: number;
  default_discount?: number;
  discount_type?: "amount" | "percent";
  default_cost?: number;
  default_stock?: number;
}
