const definitions = [
  ['JavaScript & TypeScript', [
    ['Easy', 'What is the difference between let, const, and var?', ['block scope', 'function scope', 'reassignment', 'temporal dead zone']],
    ['Medium', 'Explain the JavaScript event loop. In what order do synchronous code, promises, and timers run?', ['call stack', 'microtask queue', 'task queue', 'promise callbacks']],
    ['Hard', 'How would you model a request state machine in TypeScript so invalid states cannot be represented?', ['discriminated unions', 'exhaustive checking', 'never type', 'state transitions']],
  ]],
  ['React & Frontend Architecture', [
    ['Easy', 'How do props and state differ in React, and what causes a component to render again?', ['props', 'local state', 'state updates', 'parent render']],
    ['Medium', 'How do you fetch data in a React effect without displaying stale responses when a dependency changes?', ['effect dependencies', 'cleanup function', 'AbortController', 'race condition']],
    ['Hard', 'Design an accessible autocomplete for a large remote dataset. How would you handle latency, keyboard navigation, and rendering cost?', ['debouncing', 'request cancellation', 'aria combobox', 'keyboard navigation', 'virtualization']],
  ]],
  ['Node.js & Backend Architecture', [
    ['Easy', 'What is middleware in Express, and how is an error passed to the error handler?', ['request response cycle', 'next function', 'middleware order', 'error handler']],
    ['Medium', 'How would you make a payment or order endpoint safe to retry after a network timeout?', ['idempotency key', 'unique constraint', 'atomic operation', 'stored response']],
    ['Hard', 'How would you process large uploads without exhausting memory, and prevent slow downstream services from overwhelming the server?', ['streams', 'backpressure', 'bounded concurrency', 'timeouts', 'resource cleanup']],
  ]],
  ['SQL & Data Modeling', [
    ['Easy', 'Explain INNER JOIN and LEFT JOIN. What happens to a row with no matching record?', ['matching rows', 'left table', 'null values', 'join condition']],
    ['Medium', 'How would you design orders and order items tables while keeping historical prices accurate?', ['primary key', 'foreign key', 'normalization', 'price snapshot', 'transaction']],
    ['Hard', 'How can two transactions both pass a balance check and overspend an account? Describe a safe solution.', ['race condition', 'transaction isolation', 'row locking', 'atomic update', 'lost update']],
  ]],
  ['Python Programming', [
    ['Easy', 'When would you use a list, tuple, set, or dictionary in Python?', ['mutable list', 'immutable tuple', 'unique set', 'key value dictionary']],
    ['Medium', 'Explain Python generators. How do they help process a file that is larger than available memory?', ['yield', 'lazy iteration', 'iterator protocol', 'bounded memory']],
    ['Hard', 'How would you choose between asyncio, threads, and processes for a Python service?', ['I/O bound', 'CPU bound', 'event loop', 'global interpreter lock', 'process isolation']],
  ]],
  ['Java & Spring Boot', [
    ['Easy', 'Explain the equals and hashCode contract and why it matters for HashMap keys.', ['equal objects', 'same hash code', 'hash collision', 'immutable keys']],
    ['Medium', 'How does dependency injection work in Spring, and why is constructor injection useful for testing?', ['container managed beans', 'constructor injection', 'dependency inversion', 'mock dependencies']],
    ['Hard', 'Explain how Spring transactional proxies work. Why might calling a transactional method from the same class not create a transaction?', ['proxy interception', 'self invocation', 'transaction boundary', 'rollback behavior']],
  ]],
  ['Data Structures & Algorithms', [
    ['Easy', 'When would you choose a hash table instead of a sorted array?', ['average constant lookup', 'binary search', 'ordering', 'memory overhead']],
    ['Medium', 'How can you find the first non-repeating character in a string efficiently?', ['frequency map', 'two passes', 'linear time', 'character ordering']],
    ['Hard', 'Design an LRU cache with constant-time get and put operations.', ['hash map', 'doubly linked list', 'eviction', 'constant time']],
  ]],
  ['Database Management Systems', [
    ['Easy', 'Explain a primary key and a foreign key, and what constraints they enforce.', ['unique identifier', 'not null', 'referential integrity', 'related table']],
    ['Medium', 'How do transactions protect an order that changes multiple tables?', ['atomicity', 'consistency', 'isolation', 'durability', 'rollback']],
    ['Hard', 'How would you add an index to a large production table without a long write outage?', ['online index creation', 'locking', 'query plan', 'write overhead', 'rollback plan']],
  ]],
  ['Operating Systems', [
    ['Easy', 'What is the difference between a process and a thread?', ['separate address space', 'shared memory', 'context switch', 'isolation']],
    ['Medium', 'Explain the conditions required for a deadlock and one way to prevent it.', ['mutual exclusion', 'hold and wait', 'no preemption', 'circular wait']],
    ['Hard', 'What causes thrashing in a virtual memory system, and how can it be reduced?', ['page faults', 'working set', 'memory pressure', 'page replacement']],
  ]],
  ['Computer Networks', [
    ['Easy', 'What happens during a DNS lookup before a browser connects to a website?', ['domain name', 'IP address', 'recursive resolver', 'DNS cache']],
    ['Medium', 'Compare TCP and UDP for a real-time application. What must an application handle itself with UDP?', ['reliability', 'packet ordering', 'congestion control', 'latency']],
    ['Hard', 'How would you diagnose intermittent connection timeouts between two services?', ['DNS resolution', 'TCP handshake', 'connection pool', 'packet loss', 'request tracing']],
  ]],
  ['System Design', [
    ['Easy', 'What does a load balancer do, and why might a service need more than one instance?', ['traffic distribution', 'availability', 'horizontal scaling', 'health checks']],
    ['Medium', 'Design a notification service that can retry failed deliveries without sending duplicates.', ['durable queue', 'idempotency', 'retry backoff', 'dead letter queue']],
    ['Hard', 'Design a distributed rate limiter. What consistency and availability trade-offs would you make?', ['token bucket', 'shared state', 'atomic updates', 'clock skew', 'network partition']],
  ]],
  ['Object-Oriented Programming', [
    ['Easy', 'Explain encapsulation with an example of protecting an object invariant.', ['private state', 'public interface', 'validation', 'invariant']],
    ['Medium', 'When is composition preferable to inheritance?', ['has a relationship', 'is a relationship', 'loose coupling', 'behavior reuse']],
    ['Hard', 'How would you refactor a class that performs validation, database access, and notification delivery?', ['single responsibility', 'dependency inversion', 'separate interfaces', 'testability']],
  ]],
  ['HR & Behavioral', [
    ['Easy', 'Tell me about a project you built. What did you personally contribute?', ['project context', 'personal responsibility', 'specific actions', 'outcome']],
    ['Medium', 'Describe a disagreement with a teammate and how you resolved it.', ['situation', 'listening', 'specific action', 'resolution', 'reflection']],
    ['Hard', 'Tell me about a serious mistake you made. How did you handle the consequences and prevent a repeat?', ['accountability', 'impact', 'corrective action', 'prevention', 'learning']],
  ]],
];
export const EXTRA_QUESTIONS = definitions.flatMap(([topic, items]) => items.map(([difficulty, questionText, referenceConcepts]) => ({
  topic, difficulty, questionText, referenceConcepts,
  type: topic === 'HR & Behavioral' ? 'Behavioral' : 'Technical',
  evaluationCriteria: ['Answer the question accurately', 'Explain the reasoning with a specific example', 'Cover the relevant constraints and trade-offs'],
})));
