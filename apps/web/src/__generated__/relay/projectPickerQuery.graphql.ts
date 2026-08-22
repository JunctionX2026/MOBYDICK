/**
 * @generated SignedSource<<2befd41e19b952d36a6d2f4ec1e4b88d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectPhase = "COMPOSE" | "DISCOVER" | "SERVE" | "%future added value";
export type projectPickerQuery$variables = Record<PropertyKey, never>;
export type projectPickerQuery$data = {
  readonly projectList: {
    readonly droppedCount: number;
    readonly projects: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
      readonly phase: ProjectPhase;
      readonly question: string;
      readonly updatedAt: string;
    }>;
  };
};
export type projectPickerQuery = {
  response: projectPickerQuery$data;
  variables: projectPickerQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "ProjectList",
    "kind": "LinkedField",
    "name": "projectList",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "droppedCount",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Project",
        "kind": "LinkedField",
        "name": "projects",
        "plural": true,
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
            "kind": "ScalarField",
            "name": "updatedAt",
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
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "projectPickerQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "projectPickerQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "7ed446d5d8b772159608bada89d1de29",
    "id": null,
    "metadata": {},
    "name": "projectPickerQuery",
    "operationKind": "query",
    "text": "query projectPickerQuery {\n  projectList {\n    droppedCount\n    projects {\n      id\n      name\n      question\n      phase\n      updatedAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7575b06b6da1dfae57e0275801a0875b";

export default node;
