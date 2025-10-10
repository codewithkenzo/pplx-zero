import { SearchInputV1, SearchOutputV1 } from '../schema.js';

interface Task<T> {
  input: T;
  resolve: () => void;
}

export class BoundedConcurrencyPool<T> {
  private concurrency: number;
  private queue: Task<T>[] = [];
  private running = 0;
  private orderPreserver: Map<string, { position: number; resolve: (output: any) => void }>;
  private nextPosition = 0;
  private completedOutputs: Map<string, any> = new Map();

  constructor(concurrency: number) {
    this.concurrency = Math.max(1, Math.min(concurrency, 20));
    this.orderPreserver = new Map();
  }

  async execute(inputs: T[], processor: (input: T) => Promise<SearchOutputV1>): Promise<SearchOutputV1[]> {
    const results: SearchOutputV1[] = new Array(inputs.length);
    const promises: Promise<void>[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const inputId = (input as any).id || `item-${i}`;
      
      // Store position for order preservation
      this.orderPreserver.set(inputId, { position: i, resolve: (output) => {
        results[i] = output;
      }});

      const promise = new Promise<void>((resolve) => {
        this.queue.push({
          input,
          resolve: () => {
            this.processInput(processor, input).then((output) => {
              const positionData = this.orderPreserver.get(inputId);
              if (positionData) {
                positionData.resolve(output);
                this.orderPreserver.delete(inputId);
              }
              resolve();
            }).catch((error) => {
              const errorOutput: SearchOutputV1 = {
                id: inputId,
                ok: false,
                error: {
                  code: 'INTERNAL_ERROR',
                  message: error.message,
                  details: error.stack,
                },
                duration: 0,
              };
              
              const positionData = this.orderPreserver.get(inputId);
              if (positionData) {
                positionData.resolve(errorOutput);
                this.orderPreserver.delete(inputId);
              }
              resolve();
            });
          }
        });
      });

      promises.push(promise);
      this.tryStart();
    }

    await Promise.all(promises);
    return results;
  }

  private async processInput(processor: (input: T) => Promise<SearchOutputV1>, input: T): Promise<SearchOutputV1> {
    try {
      return await processor(input);
    } catch (error) {
      const inputId = (input as any).id || 'unknown';
      return {
        id: inputId,
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : String(error),
          details: error instanceof Error ? error.stack : undefined,
        },
        duration: 0,
      };
    }
  }

  private tryStart(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        this.running++;
        task.resolve();
        
        // When task completes, decrement running count and try to start next
        setTimeout(() => {
          this.running--;
          this.tryStart();
        }, 0);
      }
    }
  }

  getStats(): { running: number; queued: number; concurrency: number } {
    return {
      running: this.running,
      queued: this.queue.length,
      concurrency: this.concurrency,
    };
  }
}
