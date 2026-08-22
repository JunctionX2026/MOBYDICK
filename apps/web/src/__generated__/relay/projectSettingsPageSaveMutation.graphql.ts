/**
 * @generated SignedSource<<bfa5d65d8e871d2da36f5df3cb96c4a6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectPhase = "COMPOSE" | "DISCOVER" | "SERVE" | "%future added value";
export type WorkflowNodeKind = "JOIN" | "OUTPUT" | "SOURCE" | "TRANSFORM" | "%future added value";
export type SaveWorkflowInput = {
  id: string;
  links: ReadonlyArray<WorkflowLinkInput>;
  nodes: ReadonlyArray<WorkflowNodeInput>;
  operationSpecJson?: string | null | undefined;
  payloadSchemaJson?: string | null | undefined;
  requestDataJson?: string | null | undefined;
};
export type WorkflowNodeInput = {
  datasetId?: string | null | undefined;
  id: string;
  kind: WorkflowNodeKind;
  position: PositionInput;
  subtitle?: string | null | undefined;
  title: string;
};
export type PositionInput = {
  x: number;
  y: number;
};
export type WorkflowLinkInput = {
  id: string;
  source: string;
  target: string;
};
export type projectSettingsPageSaveMutation$variables = {
  input: SaveWorkflowInput;
};
export type projectSettingsPageSaveMutation$data = {
  readonly saveWorkflow: {
    readonly id: string;
    readonly name: string;
    readonly phase: ProjectPhase;
    readonly updatedAt: string;
  };
};
export type projectSettingsPageSaveMutation = {
  response: projectSettingsPageSaveMutation$data;
  variables: projectSettingsPageSaveMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "Project",
    "kind": "LinkedField",
    "name": "saveWorkflow",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "name",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "phase",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "updatedAt",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "projectSettingsPageSaveMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "projectSettingsPageSaveMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "ae150ece24dc88bf35b0dfe2f5877bec",
    "id": null,
    "metadata": {},
    "name": "projectSettingsPageSaveMutation",
    "operationKind": "mutation",
    "text": "mutation projectSettingsPageSaveMutation(\n  $input: SaveWorkflowInput!\n) {\n  saveWorkflow(input: $input) {\n    id\n    name\n    phase\n    updatedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "5ce7f87db811eaf7bf62b890b5ab4fe7";

export default node;
