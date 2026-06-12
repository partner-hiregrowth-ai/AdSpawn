"use client";

import { SimpleAdForm, SimpleAdFormProps } from "./SimpleAdForm";

export function LeadsAdForm(props: Omit<SimpleAdFormProps, "defaultName">) {
  return <SimpleAdForm {...props} defaultName="New Leads Ad" />;
}
