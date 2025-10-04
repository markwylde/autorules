/**
 * Global task queue with worker pool for AI operations
 */
export class TaskQueue {
	queue = [];
	activeWorkers = 0;
	maxWorkers;
	constructor(maxWorkers) {
		this.maxWorkers = maxWorkers;
	}
	/**
	 * Add a task to the queue
	 */
	async enqueue(task) {
		return new Promise((resolve, reject) => {
			this.queue.push({ task, resolve, reject });
			this.processQueue();
		});
	}
	/**
	 * Process the queue with worker pool
	 */
	async processQueue() {
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
	async drain() {
		while (this.queue.length > 0 || this.activeWorkers > 0) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}
}
//# sourceMappingURL=taskQueue.js.map
