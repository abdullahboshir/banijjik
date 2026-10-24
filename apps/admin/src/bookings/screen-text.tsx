"use client";

import { createContext, useContext, type ReactElement, type ReactNode } from "react";

/** Screen texts the server page resolved. The browser catalog carries only the shared keys, so screen labels travel as props. */
export type ScreenTexts = Readonly<Record<string, string>>;

const PLACEHOLDER_PATTERN = /\{([\w.]+)\}/g;
const ScreenTextContext = createContext<ScreenTexts>({});

export function ScreenTextProvider(props: {
  texts: ScreenTexts;
  children: ReactNode;
}): ReactElement {
  return (
    <ScreenTextContext.Provider value={props.texts}>{props.children}</ScreenTextContext.Provider>
  );
}

export type ScreenText = (
  key: string,
  values?: Readonly<Record<string, string | number>>,
) => string;

/** Looks a text up and fills its {placeholders}; an unknown key shows as itself, like the translator does. */
export function useScreenText(): ScreenText {
  const texts = useContext(ScreenTextContext);
  return (key, values = {}) => {
    const text = texts[key];
    if (text === undefined) return key;
    return text.replace(PLACEHOLDER_PATTERN, (placeholder, name: string) =>
      String(values[name] ?? placeholder),
    );
  };
}
