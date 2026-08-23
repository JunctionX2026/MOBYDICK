/**
 * @generated SignedSource<<b8d177a5f0172e9c65cf67f38041a031>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectPhase = "COMPOSE" | "DISCOVER" | "SERVE" | "%future added value";
export type WorkflowNodeKind = "OPERATION" | "OUTPUT" | "SOURCE" | "%future added value";
export type projectShellQuery$variables = {
  id: string;
};
export type projectShellQuery$data = {
  readonly project: {
    readonly id: string;
    readonly name: string;
    readonly phase: ProjectPhase;
    readonly question: string;
    readonly workflow: {
      readonly links: ReadonlyArray<{
        readonly id: string;
        readonly intent: string | null | undefined;
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
  } | null | undefined;
};
export type projectShellQuery = {
  response: projectShellQuery$data;
  variables: projectShellQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
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
        "name": "id",
        "variableName": "id"
      }
    ],
    "concreteType": "Project",
    "kind": "LinkedField",
    "name": "project",
    "plural": false,
    "selections": [
      (v1/*:: as any*/),
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
        "name": "question",
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
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "intent",
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
    "name": "projectShellQuery",
    "selections": (v2/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "projectShellQuery",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "6ecb69410b22d4f709781f6bdac537c9",
    "id": null,
    "metadata": {},
    "name": "projectShellQuery",
    "operationKind": "query",
    "text": "query projectShellQuery(\n  $id: ID!\n) {\n  project(id: $id) {\n    id\n    name\n    question\n    phase\n    workflow {\n      nodes {\n        id\n        kind\n        title\n        subtitle\n        datasetId\n        position {\n          x\n          y\n        }\n      }\n      links {\n        id\n        source\n        target\n        intent\n      }\n      operationSpecJson\n      requestDataJson\n      payloadSchemaJson\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3c2155a35a239962edd0d31a5e41a285";

export default node;
