"use client";

import {
  createContext,
  useContext,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";

/** `| undefined` is explicit so callers can pass optional values under exactOptionalPropertyTypes. */
export interface LinkProps {
  href: string;
  className?: string | undefined;
  children: ReactNode;
  "aria-current"?: "page" | undefined;
  onClick?: (() => void) | undefined;
}

export type LinkComponent = ComponentType<LinkProps>;

/** Default link: a plain anchor. Apps pass their router link once at the root (for example Next's Link). */
function AnchorLink({ children, ...props }: LinkProps): ReactElement {
  return <a {...props}>{children}</a>;
}

const LinkComponentContext = createContext<LinkComponent>(AnchorLink);

export function LinkComponentProvider({
  component,
  children,
}: {
  component: LinkComponent;
  children: ReactNode;
}): ReactElement {
  return <LinkComponentContext value={component}>{children}</LinkComponentContext>;
}

export function useLinkComponent(): LinkComponent {
  return useContext(LinkComponentContext);
}
