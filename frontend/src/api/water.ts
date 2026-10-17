// Water bills + meter readings over Supabase (ported from el-property's
// client-only WaterTransactionsPage). Filtering, stats, and the payment ledger
// stay client-side, exactly as the source page did over localStorage — the
// adapter keeps the page's camelCase model, mapped from snake_case columns.
import { supabase } from "./client";
import type { WaterBill, MeterReading } from "../pages/WaterTransactionsPage";

type WaterBillRow = {
  id: string;
  bill_number: string;
  property: string;
  unit: string;
  tenant: string;
  method: "submeter" | "rubs";
  previous_reading: string | number | null;
  current_reading: string | number | null;
  consumption: string | number | null;
  rubs_factor: string | null;
  rate_per_unit: string | number;
  base_charge: string | number;
  sewer_fee: string | number;
  total_amount: string | number;
  billing_period: string;
  due_date: string;
  status: "paid" | "pending" | "overdue";
  payment_date: string | null;
  payment_method: string | null;
};

type WaterReadingRow = {
  id: string;
  meter_id: string;
  property: string;
  unit: string;
  tenant: string;
  previous_reading: string | number;
  current_reading: string | number;
  consumption: string | number;
  reading_date: string;
  reader_name: string;
  leak_warning: boolean;
};

function toWaterBill(row: WaterBillRow): WaterBill {
  return {
    id: row.id,
    billNumber: row.bill_number,
    property: row.property,
    unit: row.unit,
    tenant: row.tenant,
    method: row.method,
    previousReading: row.previous_reading == null ? undefined : Number(row.previous_reading),
    currentReading: row.current_reading == null ? undefined : Number(row.current_reading),
    consumption: row.consumption == null ? undefined : Number(row.consumption),
    rubsFactor: row.rubs_factor ?? undefined,
    ratePerUnit: Number(row.rate_per_unit),
    baseCharge: Number(row.base_charge),
    sewerFee: Number(row.sewer_fee),
    totalAmount: Number(row.total_amount),
    billingPeriod: row.billing_period,
    dueDate: row.due_date,
    status: row.status,
    paymentDate: row.payment_date ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
  };
}

function toMeterReading(row: WaterReadingRow): MeterReading {
  return {
    id: row.id,
    meterId: row.meter_id,
    property: row.property,
    unit: row.unit,
    tenant: row.tenant,
    previousReading: Number(row.previous_reading),
    currentReading: Number(row.current_reading),
    consumption: Number(row.consumption),
    readingDate: row.reading_date,
    readerName: row.reader_name,
    leakWarning: row.leak_warning || undefined,
  };
}

export interface NewWaterBillInput {
  billNumber: string;
  property: string;
  unit: string;
  tenant: string;
  method: "submeter" | "rubs";
  previousReading?: number;
  currentReading?: number;
  consumption?: number;
  rubsFactor?: string;
  ratePerUnit: number;
  baseCharge: number;
  sewerFee: number;
  totalAmount: number;
  billingPeriod: string;
  dueDate: string;
}

export async function getWaterBills(): Promise<WaterBill[]> {
  const { data, error } = await supabase
    .from("water_bills")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data || []) as unknown as WaterBillRow[]).map(toWaterBill);
}

export async function createWaterBill(input: NewWaterBillInput): Promise<WaterBill> {
  const { data, error } = await supabase
    .from("water_bills")
    .insert({
      bill_number: input.billNumber,
      property: input.property,
      unit: input.unit,
      tenant: input.tenant,
      method: input.method,
      previous_reading: input.previousReading,
      current_reading: input.currentReading,
      consumption: input.consumption,
      rubs_factor: input.rubsFactor,
      rate_per_unit: input.ratePerUnit,
      base_charge: input.baseCharge,
      sewer_fee: input.sewerFee,
      total_amount: input.totalAmount,
      billing_period: input.billingPeriod,
      due_date: input.dueDate,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toWaterBill(data as unknown as WaterBillRow);
}

export async function markWaterBillPaid(
  id: string,
  paymentMethod: string,
): Promise<void> {
  const { error } = await supabase
    .from("water_bills")
    .update({
      status: "paid",
      payment_date: new Date().toISOString().split("T")[0],
      payment_method: paymentMethod,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getWaterReadings(): Promise<MeterReading[]> {
  const { data, error } = await supabase
    .from("water_readings")
    .select("*")
    .order("reading_date", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data || []) as unknown as WaterReadingRow[]).map(toMeterReading);
}

export interface NewWaterReadingInput {
  meterId: string;
  property: string;
  unit: string;
  tenant: string;
  previousReading: number;
  currentReading: number;
  consumption: number;
  readingDate: string;
  readerName: string;
  leakWarning?: boolean;
}

export async function createWaterReading(
  input: NewWaterReadingInput,
): Promise<MeterReading> {
  const { data, error } = await supabase
    .from("water_readings")
    .insert({
      meter_id: input.meterId,
      property: input.property,
      unit: input.unit,
      tenant: input.tenant,
      previous_reading: input.previousReading,
      current_reading: input.currentReading,
      consumption: input.consumption,
      reading_date: input.readingDate,
      reader_name: input.readerName,
      leak_warning: input.leakWarning ?? false,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toMeterReading(data as unknown as WaterReadingRow);
}
