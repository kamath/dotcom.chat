/**
 * Represents a commit in the GitChat system.
 * @property {string} id - The unique identifier for the commit.
 * @property {string} message - The commit message describing the change.
 * @property {string} author - The author of the commit.
 * @property {string} date - The ISO string date of the commit.
 * @property {string} [parentId] - The ID of the parent commit, if any.
 * @property {object} [metadata] - Optional additional metadata for the commit.
 */
export interface Commit {
  id: string;
  message: string;
  author: string;
  date: string;
  parentId?: string;
  detached?: boolean;
  metadata?: object;
}

export interface GitChatClient {
  /**
   * Add a commit to the chat.
   * @param commit - The commit to add (partial to allow for auto-generated fields like id and date).
   * @returns The chat object.
   */
  addCommit(commit: Partial<Commit>): void;
  clearCommits(): void;
  detachCommit(commitId: string): void;
  retachCommit(commitId: string): void;
}
