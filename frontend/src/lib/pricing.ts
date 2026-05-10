export type DiscountType = "amount" | "percent";

export const computeSellingPrice = (
  regularPrice: number,
  discount: number,
  discountType: DiscountType,
): number => {
  if (discountType === "percent") {
    return Math.max(0, regularPrice - (regularPrice * discount) / 100);
  }

  return Math.max(0, regularPrice - discount);
};
