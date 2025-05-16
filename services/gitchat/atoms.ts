import { atomWithStorage } from "jotai/utils";
import { atom } from "jotai/vanilla";
import type { Commit } from "./client";
import type { Message } from "ai";

export const ROOT_COMMIT: Commit = {
  id: "ROOT_COMMIT",
  author: "system",
  message: "Initial commit",
  parentId: undefined,
  detached: false,
  date: new Date().toISOString(),
  metadata: {
    message: {
      role: "system",
      content: "Initial commit",
      id: "ROOT_COMMIT",
    },
  },
};

export const commitsAtom = atomWithStorage<Record<string, Commit>>("commits", {
  [ROOT_COMMIT.id]: ROOT_COMMIT,
});
export const commitHeadAtom = atomWithStorage<string>(
  "commitHead",
  ROOT_COMMIT.id
);
export const loadingCommitThreadAtom = atom(false);
export const AISDKMessagesAtom = atom<Message[]>([]);
export const isLoadingAtom = atom(false);

/**
 * Get the active commit thread as a list of commits.
 * @returns The commit thread, or undefined if not found.
 */
export const commitThreadAtom = atom((get) => {
  const commits = get(commitsAtom);
  const commitHead = get(commitHeadAtom);
  // Create a map for quick lookup by id
  const commitMap = new Map(Object.values(commits).map((c) => [c.id, c]));
  let node = commitHead ? commits[commitHead] : null;
  const result: Commit[] = [];
  let i = 0;
  while (node && i < Object.keys(commits).length) {
    result.push(node);
    if (!node.parentId || node.detached) break;
    node = commitMap.get(node.parentId) ?? null;
    i++;
  }
  result.reverse();

  //   console.log("TEST COMMIT CALLED HERE", commits, commitHead, result);
  return result;
});

/**
 * Get the full list of commits, including detached commits for the sidebar.
 * @returns The full list of commits.
 */
export const fullCommitListAtom = atom((get) => {
  const commits = get(commitsAtom);
  return Object.values(commits);
});

/**
 * Get the indices of the children of the current commit within fullCommitListAtom.
 * i.e. { commit.id : index }
 * @returns The indices of the children of the current commit within fullCommitListAtom.
 */
export const currentCommitChildrenAtom = atom((get) => {
  console.log("CURRENT COMMIT CHILDREN CALLED");
  const commitList = get(fullCommitListAtom);
  const commitHead = get(commitHeadAtom);
  const children = commitList.filter((c) => {
    return c.parentId === commitHead && !c.detached;
  });
  return children;
});

export const currentCommitChildrenIndexMapAtom = atom((get) => {
  const children = get(currentCommitChildrenAtom);
  // Collapse children into a map of { commit.id : index }
  const childrenMap: Record<string, number> = {};
  children.forEach((c, idx) => {
    childrenMap[c.id] = idx;
  });
  console.log("THREAD CHILDREN", childrenMap);
  return childrenMap;
});

/**
 * Get the last commit from the user.
 * @returns The last commit from the user, or undefined if not found.
 */
export const lastUserCommitAtom = atom((get) => {
  const commits = get(commitsAtom);
  const commitHead = get(commitHeadAtom);
  let currentId: string | null = commitHead;
  let node = undefined;
  while (currentId) {
    const commit: Commit | undefined = commits[currentId];
    if (!commit) break;
    if (commit.author === "user") {
      node = commit;
      break;
    }
    currentId = commit.parentId ?? null;
  }
  return node;
});
