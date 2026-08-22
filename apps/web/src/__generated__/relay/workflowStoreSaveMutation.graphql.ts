/**
 * @generated SignedSource<<c39dc685708642c6e2b5856fee3bae4c>>
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
export type workflowStoreSaveMutation$variables = {
  input: SaveWorkflowInput;
};
export type workflowStoreSaveMutation$data = {
  readonly saveWorkflow: {
    readonly id: string;
    readonly phase: ProjectPhase;
    readonly updatedAt: string;
    readonly workflow: {
      readonly links: ReadonlyArray<{
        readonly id: string;
        readonly source: string;
        readonly target: string;
      }>;
      readonly nodes: ReadonlyArray<{
        readonly datasetId: string | null | undefined;
        readonly id: string;
        readonly kind: WorkflowNodeKind;
        readonly position: {
          readonly x: number;
          readonly y: number;
        };
        readonly subtitle: string | null | undefined;
        readonly title: string;
      }>;
      readonly operationSpecJson: string | null | undefined;
      readonly payloadSchemaJson: string | null | undefined;
      readonly requestDataJson: string;
    };
  };
};
export type workflowStoreSaveMutation = {
  response: workflowStoreSaveMutation$data;
  variables: workflowStoreSaveMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
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
      (v1/*:: as any*/),
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
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Workflow",
        "kind": "LinkedField",
        "name": "workflow",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "WorkflowNode",
            "kind": "LinkedField",
            "name": "nodes",
            "plural": true,
            "selections": [
              (v1/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "kind",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "title",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "subtitle",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "datasetId",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "Position",
                "kind": "LinkedField",
                "name": "position",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "x",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "y",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "WorkflowLink",
            "kind": "LinkedField",
            "name": "links",
            "plural": true,
            "selections": [
              (v1/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "source",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "target",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "operationSpecJson",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "requestDataJson",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "payloadSchemaJson",
            "storageKey": null
          }
        ],
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
    "name": "workflowStoreSaveMutation",
    "selections": (v2/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "workflowStoreSaveMutation",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "77c121a911f1cbd0a0dbf4e5efefd23e",
    "id": null,
    "metadata": {},
    "name": "workflowStoreSaveMutation",
    "operationKind": "mutation",
    "text": "mutation workflowStoreSaveMutation(\n  $input: SaveWorkflowInput!\n) {\n  saveWorkflow(input: $input) {\n    id\n    phase\n    updatedAt\n    workflow {\n      nodes {\n        id\n        kind\n        title\n        subtitle\n        datasetId\n        position {\n          x\n          y\n        }\n      }\n      links {\n        id\n        source\n        target\n      }\n      operationSpecJson\n      requestDataJson\n      payloadSchemaJson\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4f963e79805f1011ba85e95f8fe37471";

export default node;
