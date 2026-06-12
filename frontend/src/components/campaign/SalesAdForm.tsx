"use client";

import { SimpleAdForm, SimpleAdFormProps } from "./SimpleAdForm";

export function SalesAdForm(props: Omit<SimpleAdFormProps, "defaultName">) {
  return <SimpleAdForm {...props} defaultName="New Sales Ad" />;
}
