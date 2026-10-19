import type { Node } from "@astryx-native/core";
import { Suspense } from "react";
import { send } from "../client.ts";
import { TEMPLATE_VIEWS } from "../templates/index.tsx";

/** A refactored stock template, drawn by its own renderer from the core's view model. */
export function TemplateNode({ node }: { node: Extract<Node, { kind: "template" }> }) {
  const View = TEMPLATE_VIEWS[node.template];
  if (!View) return null;
  return (
    <Suspense fallback={null}>
      <View view={node.view} send={send} />
    </Suspense>
  );
}
