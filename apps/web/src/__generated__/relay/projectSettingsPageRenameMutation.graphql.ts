/**
 * @generated SignedSource<<9ae5b408dbb9234422f38de4e10e416d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type RenameProjectInput = {
  id: string;
  name: string;
};
export type projectSettingsPageRenameMutation$variables = {
  input: RenameProjectInput;
};
export type projectSettingsPageRenameMutation$data = {
  readonly renameProject: {
    readonly id: string;
    readonly name: string;
    readonly updatedAt: string;
  };
};
export type projectSettingsPageRenameMutation = {
  response: projectSettingsPageRenameMutation$data;
  variables: projectSettingsPageRenameMutation$variables;
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
    "name": "renameProject",
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
    "name": "projectSettingsPageRenameMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "projectSettingsPageRenameMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "f6c91b580943117597ab6e2f82ee51e1",
    "id": null,
    "metadata": {},
    "name": "projectSettingsPageRenameMutation",
    "operationKind": "mutation",
    "text": "mutation projectSettingsPageRenameMutation(\n  $input: RenameProjectInput!\n) {\n  renameProject(input: $input) {\n    id\n    name\n    updatedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "99508f6a6aeae71c2b4bf330a546dc96";

export default node;
