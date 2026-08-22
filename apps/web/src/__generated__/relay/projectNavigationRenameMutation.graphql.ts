/**
 * @generated SignedSource<<7e8e96ea8e307213bac77b23afb8889c>>
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
export type projectNavigationRenameMutation$variables = {
  input: RenameProjectInput;
};
export type projectNavigationRenameMutation$data = {
  readonly renameProject: {
    readonly id: string;
    readonly name: string;
    readonly updatedAt: string;
  };
};
export type projectNavigationRenameMutation = {
  response: projectNavigationRenameMutation$data;
  variables: projectNavigationRenameMutation$variables;
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
    "name": "projectNavigationRenameMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "projectNavigationRenameMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "eb12629a869fa6dd7a94338fef9361e5",
    "id": null,
    "metadata": {},
    "name": "projectNavigationRenameMutation",
    "operationKind": "mutation",
    "text": "mutation projectNavigationRenameMutation(\n  $input: RenameProjectInput!\n) {\n  renameProject(input: $input) {\n    id\n    name\n    updatedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "96367b51db9995f1456c5d8a7047cfd6";

export default node;
