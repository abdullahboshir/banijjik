import type { ReactElement } from "react";
import { ContactLinkInput } from "./contact-link-input.js";
import type { CustomFieldControlProps } from "./custom-field-controls.js";

/** The CONTACT_LINK control of the custom field form. Without link support it draws nothing. */
export function ContactLinkControl(props: CustomFieldControlProps): ReactElement {
  const { contactLink } = props;
  if (contactLink === undefined) return <></>;
  return (
    <ContactLinkInput
      id={props.inputId}
      value={props.value}
      onChange={props.onValueChange}
      search={contactLink.search}
      nameOf={contactLink.nameOf}
      labels={contactLink.labels}
      error={props.error}
      disabled={props.disabled}
      isRequired={props.isRequired}
    />
  );
}
