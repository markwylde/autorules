/**
 * Global task queue with worker pool for AI operations
 */
export type Task<T> = () => Promise<T>;
export declare class TaskQueue {
	private queue;
	private activeWorkers;
	private maxWorkers;
	constructor(maxWorkers: number);
	/**
	 * Add a task to the queue
	 */
	enqueue<T>(task: Task<T>): Promise<T>;
	/**
	 * Process the queue with worker pool
	 */
	private processQueue;
	/**
	 * Wait for all tasks to complete
	 */
	drain(): Promise<void>;
}
//# sourceMappingURL=taskQueue.d.ts.map
