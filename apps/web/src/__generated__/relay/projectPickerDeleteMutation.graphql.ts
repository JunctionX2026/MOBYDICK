/**
 * @generated SignedSource<<a68cfc58510d7abfae6becf3ddd74a24>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type projectPickerDeleteMutation$variables = {
  id: string;
};
export type projectPickerDeleteMutation$data = {
  readonly deleteProject: {
    readonly deletedProjectId: string;
  };
};
export type projectPickerDeleteMutation = {
  response: projectPickerDeleteMutation$data;
  variables: projectPickerDeleteMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
    "concreteType": "DeleteProjectPayload",
    "kind": "LinkedField",
    "name": "deleteProject",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "deletedProjectId",
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
    "name": "projectPickerDeleteMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "projectPickerDeleteMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "2a08bd31d4b833503cee898d9a4ee4d5",
    "id": null,
    "metadata": {},
    "name": "projectPickerDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation projectPickerDeleteMutation(\n  $id: ID!\n) {\n  deleteProject(id: $id) {\n    deletedProjectId\n  }\n}\n"
  }
};
})();

(node as any).hash = "9b55d0884ac02e80abc0b8e2bd955524";

export default node;
