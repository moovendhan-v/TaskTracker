import {
  GraphQLError,
  Kind,
  type ASTVisitor,
  type FragmentDefinitionNode,
  type SelectionSetNode,
  type ValidationContext,
} from 'graphql';

/**
 * Rejects operations nested deeper than `maxDepth`, following fragments.
 * Introspection fields (`__schema`, `__type`) are skipped; production turns
 * introspection off separately.
 */
export function depthLimitRule(maxDepth: number) {
  return (context: ValidationContext): ASTVisitor => {
    const fragments = new Map<string, FragmentDefinitionNode>(
      context
        .getDocument()
        .definitions.filter((definition): definition is FragmentDefinitionNode => definition.kind === Kind.FRAGMENT_DEFINITION)
        .map((fragment) => [fragment.name.value, fragment]),
    );

    const depthOf = (selectionSet: SelectionSetNode, visited: ReadonlySet<string>): number => {
      let deepest = 0;
      for (const selection of selectionSet.selections) {
        if (selection.kind === Kind.FIELD) {
          if (selection.name.value.startsWith('__')) continue;
          const childDepth = selection.selectionSet ? depthOf(selection.selectionSet, visited) : 0;
          deepest = Math.max(deepest, 1 + childDepth);
        } else if (selection.kind === Kind.INLINE_FRAGMENT) {
          deepest = Math.max(deepest, depthOf(selection.selectionSet, visited));
        } else {
          const name = selection.name.value;
          const fragment = fragments.get(name);
          // A fragment that spreads itself is already reported by graphql's NoFragmentCycles rule.
          if (fragment && !visited.has(name)) deepest = Math.max(deepest, depthOf(fragment.selectionSet, new Set([...visited, name])));
        }
      }
      return deepest;
    };

    return {
      OperationDefinition(operation) {
        const depth = depthOf(operation.selectionSet, new Set());
        if (depth > maxDepth) {
          context.reportError(
            new GraphQLError(`Query is ${depth} levels deep; the limit is ${maxDepth}`, {
              nodes: [operation],
              extensions: { code: 'QUERY_TOO_DEEP' },
            }),
          );
        }
      },
    };
  };
}
