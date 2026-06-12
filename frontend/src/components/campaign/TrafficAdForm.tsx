"use client";

import { SimpleAdForm, SimpleAdFormProps } from "./SimpleAdForm";

export function TrafficAdForm(props: Omit<SimpleAdFormProps, "defaultName">) {
  return <SimpleAdForm {...props} defaultName="New Traffic Ad" />;
}
