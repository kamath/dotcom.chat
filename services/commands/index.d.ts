export type Command = {
  id: string;
  name: string;
  onSelect?: () => void;
  parentId?: string;
};
