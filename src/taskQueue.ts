/**
 * Global task queue with worker pool for AI operations
 */

export type Task<T> = () => Promise<T>;

export class TaskQueue {
	private queue: Array<{
		task: Task<unknown>;
		resolve: (value: unknown) => void;
		reject: (reason?: unknown) => void;
	}> = [];
	private activeWorkers = 0;
	private maxWorkers: number;

	constructor(maxWorkers: number) {
		this.maxWorkers = maxWorkers;
	}

	/**
	 * Add a task to the queue
	 */
	async enqueue<T>(task: Task<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			this.queue.push({ task, resolve, reject });
			this.processQueue();
		});
	}

	/**
	 * Process the queue with worker pool
	 */
	private async processQueue() {
		if (this.activeWorkers >= this.maxWorkers || this.queue.length === 0) {
			return;
		}

		const item = this.queue.shift();
		if (!item) return;

		this.activeWorkers++;

		try {
			const result = await item.task();
			item.resolve(result);
		} catch (error) {
			item.reject(error);
		} finally {
			this.activeWorkers--;
			this.processQueue();
		}
	}

	/**
	 * Wait for all tasks to complete
	 */
	async drain(): Promise<void> {
		while (this.queue.length > 0 || this.activeWorkers > 0) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}
}
