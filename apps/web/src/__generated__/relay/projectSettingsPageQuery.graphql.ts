/**
 * @generated SignedSource<<1e8bbd7d3cd71813bc633ff781107c72>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type WorkflowNodeKind = "JOIN" | "OUTPUT" | "SOURCE" | "TRANSFORM" | "%future added value";
export type projectSettingsPageQuery$variables = {
  id: string;
};
export type projectSettingsPageQuery$data = {
  readonly project: {
    readonly id: string;
    readonly name: string;
    readonly question: string;
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
  } | null | undefined;
};
export type projectSettingsPageQuery = {
  response: projectSettingsPageQuery$data;
  variables: projectSettingsPageQuery$variables;
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
    "name": "projectSettingsPageQuery",
    "selections": (v2/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "projectSettingsPageQuery",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "1baf651955bc490e7818d24ac1c3684a",
    "id": null,
    "metadata": {},
    "name": "projectSettingsPageQuery",
    "operationKind": "query",
    "text": "query projectSettingsPageQuery(\n  $id: ID!\n) {\n  project(id: $id) {\n    id\n    name\n    question\n    workflow {\n      nodes {\n        id\n        kind\n        title\n        subtitle\n        datasetId\n        position {\n          x\n          y\n        }\n      }\n      links {\n        id\n        source\n        target\n      }\n      operationSpecJson\n      requestDataJson\n      payloadSchemaJson\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ed8e671a9e836f5acc01e1367045ae6b";

export default node;
