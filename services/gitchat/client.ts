import { Message } from "ai";
import { Commit as ICommit } from ".";
import {
  commitHeadAtom,
  commitsAtom,
  commitThreadAtom,
  lastUserCommitAtom,
  ROOT_COMMIT,
} from "./atoms";
import { getDefaultStore } from "jotai";
import { GitChatClient } from ".";

export type Commit = ICommit & {
  metadata: {
    message: Message;
  };
};

export class GitChat implements GitChatClient {
  private get state() {
    const store = getDefaultStore();
    return store;
  }

  public get commits() {
    return this.state.get(commitsAtom);
  }

  public get commitHead() {
    return this.state.get(commitHeadAtom);
  }

  public get commitThread() {
    return this.state.get(commitThreadAtom);
  }

  private set commits(commits: Record<string, Commit>) {
    this.state.set(commitsAtom, commits);
  }

  /**
   * Initialize the GitChat client.
   */
  public static init(): GitChat {
    return new GitChat();
  }

  /**
   * Add a commit to the chat.
   * @param commit - The commit to add.
   */
  public addCommit(commit: Commit, replace?: boolean): void {
    if (replace && !this.commits[commit.id]) {
      this.commits = { ...this.commits, [commit.id]: commit };
    }
  }

  /**
   * Clear the commits from the chat tree.
   */
  public clearCommits(hardDelete?: boolean): void {
    if (hardDelete) {
      this.commits = {};
    }
    this.state.set(commitHeadAtom, ROOT_COMMIT.id);
  }

  /**
   * Detach a commit from the chat.
   * @param commitId - The id of the commit to detach.
   */
  public detachCommit(commitId: string): void {
    this.commits[commitId].detached = true;
    this.commits = { ...this.commits };
  }

  /**
   * Retach a commit back to its head
   * @param commitId - The id of the commit to retach.
   */
  public retachCommit(commitId: string): void {
    this.commits[commitId].detached = false;
    this.commits = { ...this.commits };
  }

  public setCommitHead(commitId: string): void {
    this.state.set(commitHeadAtom, commitId);
  }

  /**
   * Allows the user to effectively start a new chat branch from the last user commit.
   */
  public redoLastUserCommit(): string | undefined {
    const lastUserCommit = this.state.get(lastUserCommitAtom);
    if (!lastUserCommit || !lastUserCommit.parentId) return;
    this.setCommitHead(lastUserCommit.parentId);
  }
}

const gitChat = GitChat.init();
export default gitChat;
