import { ACCOUNT_TYPE, type SystemAccountSeed } from "./accounting-contracts.js";
import { SYSTEM_ACCOUNT_CODE } from "./system-account-code.js";

/** The system chart seeded for every organization (11 §10). Names are the seed labels; UI may translate. */
export const SYSTEM_ACCOUNT_SEEDS: readonly SystemAccountSeed[] = Object.freeze([
  {
    accountCode: SYSTEM_ACCOUNT_CODE.CASH,
    accountType: ACCOUNT_TYPE.ASSET,
    name: { bn: "নগদ", en: "Cash" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.BKASH,
    accountType: ACCOUNT_TYPE.ASSET,
    name: { bn: "বিকাশ", en: "bKash" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.NAGAD,
    accountType: ACCOUNT_TYPE.ASSET,
    name: { bn: "নগদ (মোবাইল)", en: "Nagad" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.BANK,
    accountType: ACCOUNT_TYPE.ASSET,
    name: { bn: "ব্যাংক", en: "Bank" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.CARD_CLEARING,
    accountType: ACCOUNT_TYPE.ASSET,
    name: { bn: "কার্ড ক্লিয়ারিং", en: "Card clearing" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.GATEWAY_CLEARING,
    accountType: ACCOUNT_TYPE.ASSET,
    name: { bn: "গেটওয়ে ক্লিয়ারিং", en: "Gateway clearing" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.COURIER_RECEIVABLE,
    accountType: ACCOUNT_TYPE.ASSET,
    name: { bn: "কুরিয়ার প্রাপ্য", en: "Courier receivable" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.RIDER_CASH,
    accountType: ACCOUNT_TYPE.ASSET,
    name: { bn: "রাইডার নগদ", en: "Rider cash" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE,
    accountType: ACCOUNT_TYPE.ASSET,
    name: { bn: "বকেয়া প্রাপ্য", en: "Accounts receivable" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.INVENTORY,
    accountType: ACCOUNT_TYPE.ASSET,
    name: { bn: "মজুদ", en: "Inventory" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.INVENTORY_DAMAGED,
    accountType: ACCOUNT_TYPE.ASSET,
    name: { bn: "ক্ষতিগ্রস্ত মজুদ", en: "Damaged inventory" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES,
    accountType: ACCOUNT_TYPE.LIABILITY,
    name: { bn: "গ্রাহক অগ্রিম", en: "Customer advances" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.STORE_CREDIT_LIABILITY,
    accountType: ACCOUNT_TYPE.LIABILITY,
    name: { bn: "স্টোর ক্রেডিট", en: "Store credit" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.TAX_PAYABLE,
    accountType: ACCOUNT_TYPE.LIABILITY,
    name: { bn: "কর পরিশোধ্য", en: "Tax payable" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.REVENUE_PRODUCT,
    accountType: ACCOUNT_TYPE.INCOME,
    name: { bn: "পণ্য বিক্রয়", en: "Product revenue" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.REVENUE_SERVICE,
    accountType: ACCOUNT_TYPE.INCOME,
    name: { bn: "সেবা আয়", en: "Service revenue" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.REVENUE_PLAN,
    accountType: ACCOUNT_TYPE.INCOME,
    name: { bn: "প্ল্যান আয়", en: "Plan revenue" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.REVENUE_RENTAL,
    accountType: ACCOUNT_TYPE.INCOME,
    name: { bn: "ভাড়া আয়", en: "Rental revenue" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.REVENUE_EVENT,
    accountType: ACCOUNT_TYPE.INCOME,
    name: { bn: "ইভেন্ট আয়", en: "Event revenue" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.DELIVERY_INCOME,
    accountType: ACCOUNT_TYPE.INCOME,
    name: { bn: "ডেলিভারি আয়", en: "Delivery income" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.CANCELLATION_FEE_INCOME,
    accountType: ACCOUNT_TYPE.INCOME,
    name: { bn: "বাতিল ফি", en: "Cancellation fee income" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.OTHER_INCOME,
    accountType: ACCOUNT_TYPE.INCOME,
    name: { bn: "অন্যান্য আয়", en: "Other income" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.SALES_DISCOUNTS,
    accountType: ACCOUNT_TYPE.INCOME,
    name: { bn: "বিক্রয় ছাড়", en: "Sales discounts" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.SALES_RETURNS,
    accountType: ACCOUNT_TYPE.INCOME,
    name: { bn: "বিক্রয় ফেরত", en: "Sales returns" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.COGS,
    accountType: ACCOUNT_TYPE.EXPENSE,
    name: { bn: "বিক্রীত পণ্যের ব্যয়", en: "Cost of goods sold" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.DAMAGE_LOSS,
    accountType: ACCOUNT_TYPE.EXPENSE,
    name: { bn: "ক্ষতির লোকসান", en: "Damage loss" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.DELIVERY_EXPENSE,
    accountType: ACCOUNT_TYPE.EXPENSE,
    name: { bn: "ডেলিভারি ব্যয়", en: "Delivery expense" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.COURIER_FEES,
    accountType: ACCOUNT_TYPE.EXPENSE,
    name: { bn: "কুরিয়ার ফি", en: "Courier fees" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.ROUNDING,
    accountType: ACCOUNT_TYPE.EXPENSE,
    name: { bn: "রাউন্ডিং", en: "Rounding" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.OWNER_EQUITY,
    accountType: ACCOUNT_TYPE.EQUITY,
    name: { bn: "মালিকের ইকুইটি", en: "Owner equity" },
  },
  {
    accountCode: SYSTEM_ACCOUNT_CODE.OPENING_BALANCE,
    accountType: ACCOUNT_TYPE.EQUITY,
    name: { bn: "প্রারম্ভিক জের", en: "Opening balance" },
  },
]);
