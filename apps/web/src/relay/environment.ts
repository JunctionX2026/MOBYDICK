import {
  Environment,
  Network,
  RecordSource,
  Store,
  type FetchFunction,
  type GraphQLResponse,
} from "relay-runtime";

const fetchGraphQL: FetchFunction = async (request, variables) => {
  const response = await fetch("/api/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: request.text,
      variables,
      operationName: request.name,
    }),
  });

  if (!response.ok) {
    throw new Error(`The GraphQL endpoint answered with ${response.status}.`);
  }

  return (await response.json()) as GraphQLResponse;
};

function createEnvironment() {
  return new Environment({
    network: Network.create(fetchGraphQL),
    store: new Store(new RecordSource()),
  });
}

let browserEnvironment: Environment | null = null;

/**
 * The browser keeps one store so a mutation in one route updates every other
 * route that reads the same record. A server render never shares a store.
 */
export function relayEnvironment(): Environment {
  if (typeof window === "undefined") {
    return createEnvironment();
  }

  browserEnvironment ??= createEnvironment();
  return browserEnvironment;
}
