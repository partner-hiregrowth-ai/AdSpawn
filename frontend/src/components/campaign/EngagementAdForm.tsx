"use client";

import { SimpleAdForm, SimpleAdFormProps } from "./SimpleAdForm";

export function EngagementAdForm(props: Omit<SimpleAdFormProps, "defaultName">) {
  return <SimpleAdForm {...props} defaultName="New Engagement Ad" />;
}
