/**
 * Global task queue with worker pool for AI operations
 */

export type Task<T> = () => Promise<T>;

interface QueueItem {
	task: () => Promise<unknown>;
	resolve: (value: unknown) => void;
	reject: (reason?: Error) => void;
}

export class TaskQueue {
	private queue: QueueItem[] = [];
	private activeWorkers = 0;
	private maxWorkers: number;

	constructor(maxWorkers: number) {
		this.maxWorkers = maxWorkers;
	}

	/**
	 * Add a task to the queue
	 */
	async enqueue<T>(task: Task<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.queue.push({
				task: task as () => Promise<unknown>,
				resolve: resolve as (value: unknown) => void,
				reject,
			});
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
			if (error instanceof Error) {
				item.reject(error);
			} else {
				item.reject(new Error(String(error)));
			}
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
