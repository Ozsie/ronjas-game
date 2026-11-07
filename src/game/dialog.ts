export type DialogLine = {
  speaker?: string;
  text: string;
};

export type DialogChoice = {
  id: string;
  text: string;
  next?: string;
};

export type DialogNode = DialogLine & {
  next?: string;
  choices?: readonly DialogChoice[];
};

export type DialogDefinition = {
  start: string;
  nodes: Readonly<Record<string, DialogNode>>;
};

export type DialogState = {
  definition: DialogDefinition;
  nodeId: string | null;
};

const validateDialog = (
  definition: DialogDefinition,
  startNodeId: string,
): void => {
  if (!definition.nodes[definition.start]) {
    throw new Error(`Unknown starting dialog node: ${definition.start}`);
  }
  if (!definition.nodes[startNodeId]) {
    throw new Error(`Unknown starting dialog node: ${startNodeId}`);
  }

  for (const [nodeId, node] of Object.entries(definition.nodes)) {
    if (!node.text.trim()) {
      throw new Error(`Dialog node "${nodeId}" must have text`);
    }
    if (node.next && node.choices?.length) {
      throw new Error(
        `Dialog node "${nodeId}" cannot have both next and choices`,
      );
    }
    if (node.next && !definition.nodes[node.next]) {
      throw new Error(`Unknown next dialog node: ${node.next}`);
    }

    const choiceIds = new Set<string>();
    for (const choice of node.choices ?? []) {
      if (!choice.id.trim() || choiceIds.has(choice.id)) {
        throw new Error(`Dialog node "${nodeId}" has an invalid choice id`);
      }
      choiceIds.add(choice.id);
      if (!choice.text.trim()) {
        throw new Error(`Dialog choice "${choice.id}" must have text`);
      }
      if (choice.next && !definition.nodes[choice.next]) {
        throw new Error(`Unknown next dialog node: ${choice.next}`);
      }
    }
  }
};

export const startDialog = (
  definition: DialogDefinition,
  startNodeId = definition.start,
): DialogState => {
  validateDialog(definition, startNodeId);
  return { definition, nodeId: startNodeId };
};

export const currentDialogNode = (state: DialogState): DialogNode | null =>
  state.nodeId ? (state.definition.nodes[state.nodeId] ?? null) : null;

export const advanceDialog = (state: DialogState): DialogState => {
  const node = currentDialogNode(state);
  if (!node || node.choices?.length) return state;
  return { ...state, nodeId: node.next ?? null };
};

export const chooseDialogOption = (
  state: DialogState,
  choiceId: string,
): DialogState => {
  const node = currentDialogNode(state);
  const choice = node?.choices?.find((option) => option.id === choiceId);
  if (!choice) return state;
  return { ...state, nodeId: choice.next ?? null };
};
