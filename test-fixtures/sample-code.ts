/**
 * Sample TypeScript code for testing code analysis
 */

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

export interface Post {
  id: number;
  title: string;
  content: string;
  authorId: number;
  published: boolean;
}

/**
 * Calculate the sum of an array of numbers
 */
export function sum(numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

/**
 * Calculate the average of an array of numbers
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
}

/**
 * Find the maximum value in an array
 */
export function max(numbers: number[]): number | undefined {
  if (numbers.length === 0) return undefined;
  return Math.max(...numbers);
}

/**
 * Find the minimum value in an array
 */
export function min(numbers: number[]): number | undefined {
  if (numbers.length === 0) return undefined;
  return Math.min(...numbers);
}

/**
 * Filter users by email domain
 */
export function filterByDomain(users: User[], domain: string): User[] {
  return users.filter(user => user.email.endsWith(`@${domain}`));
}

/**
 * Get posts by a specific author
 */
export function getPostsByAuthor(posts: Post[], authorId: number): Post[] {
  return posts.filter(post => post.authorId === authorId);
}

/**
 * Get all published posts
 */
export function getPublishedPosts(posts: Post[]): Post[] {
  return posts.filter(post => post.published);
}

/**
 * Format a user's display name
 */
export function formatDisplayName(user: User): string {
  return `${user.name} <${user.email}>`;
}

/**
 * Create a new user with auto-generated ID
 */
export function createUser(name: string, email: string): User {
  return {
    id: Date.now(),
    name,
    email,
    createdAt: new Date(),
  };
}

/**
 * Validate an email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper class for managing users
export class UserManager {
  private users: User[] = [];

  add(user: User): void {
    this.users.push(user);
  }

  findById(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }

  findByEmail(email: string): User | undefined {
    return this.users.find(u => u.email === email);
  }

  getAll(): User[] {
    return [...this.users];
  }

  count(): number {
    return this.users.length;
  }
}
