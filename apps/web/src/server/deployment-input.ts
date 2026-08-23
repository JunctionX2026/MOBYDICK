export function resolvePayloadSchema(
  requestSchema: Record<string, unknown> | undefined,
  storedSchema: Record<string, unknown> | null | undefined,
) {
  const explicitSchema = requestSchema != null && Object.keys(requestSchema).length > 0 ? requestSchema : undefined;

  if (explicitSchema != null) {
    return explicitSchema;
  }

  return storedSchema != null && Object.keys(storedSchema).length > 0 ? storedSchema : undefined;
}
