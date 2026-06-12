"use client";

import { SimpleAdForm, SimpleAdFormProps } from "./SimpleAdForm";

export function AwarenessAdForm(props: Omit<SimpleAdFormProps, "defaultName">) {
  return <SimpleAdForm {...props} defaultName="New Awareness Ad" />;
}
