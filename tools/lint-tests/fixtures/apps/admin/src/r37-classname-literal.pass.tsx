type Node = object;

export function Greeting(label: string): Node {
  return <p className={"px-2"}>{label}</p>;
}
