/**
 * @generated SignedSource<<df728a9a82c314dbb344f15c27cbf64e>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectPhase = "COMPOSE" | "DISCOVER" | "SERVE" | "%future added value";
export type CreateProjectInput = {
  name?: string | null | undefined;
  question: string;
};
export type projectPickerCreateMutation$variables = {
  input: CreateProjectInput;
};
export type projectPickerCreateMutation$data = {
  readonly createProject: {
    readonly id: string;
    readonly name: string;
    readonly phase: ProjectPhase;
    readonly question: string;
    readonly updatedAt: string;
  };
};
export type projectPickerCreateMutation = {
  response: projectPickerCreateMutation$data;
  variables: projectPickerCreateMutation$variables;
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
    "name": "createProject",
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "projectPickerCreateMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "projectPickerCreateMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "8a27c1a51505f7b7381a00694274df15",
    "id": null,
    "metadata": {},
    "name": "projectPickerCreateMutation",
    "operationKind": "mutation",
    "text": "mutation projectPickerCreateMutation(\n  $input: CreateProjectInput!\n) {\n  createProject(input: $input) {\n    id\n    name\n    question\n    phase\n    updatedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "0328d5174a088ee0df0f571c738198f8";

export default node;
