"use client";

import { SimpleAdForm, SimpleAdFormProps } from "./SimpleAdForm";

export function AppPromotionAdForm(props: Omit<SimpleAdFormProps, "defaultName">) {
  return <SimpleAdForm {...props} defaultName="New App Promotion Ad" />;
}
