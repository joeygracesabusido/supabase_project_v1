export type Property = { id: string; name: string; address: string };
export type Unit = {
  id: string;
  property_id: string;
  unit_number: string;
  rent: number;
  status: 'vacant' | 'occupied';
};
export type Tenant = { id: string; full_name: string; email: string | null; unit_id: string | null };
export type Payment = {
  id: string;
  tenant_id: string;
  unit_id: string;
  amount: number;
  method: 'cash' | 'gcash' | 'bank' | 'other';
  for_month: string;
  paid_on: string;
};
export type Tab = 'overview' | 'properties' | 'units' | 'payments';
