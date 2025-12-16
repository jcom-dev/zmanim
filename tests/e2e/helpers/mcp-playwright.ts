/**
 * MCP Playwright Helper Functions
 *
 * These utilities help interact with the Playwright MCP server
 * for browser automation testing.
 */

export interface MCPPlaywrightServer {
  navigate: (url: string) => Promise<void>;
  snapshot: () => Promise<string>;
  click: (element: string, ref: string) => Promise<void>;
  type: (element: string, ref: string, text: string, submit?: boolean) => Promise<void>;
  screenshot: (options?: ScreenshotOptions) => Promise<string>;
  waitFor: (options: WaitForOptions) => Promise<void>;
  close: () => Promise<void>;
}

export interface ScreenshotOptions {
  type?: 'png' | 'jpeg';
  filename?: string;
  element?: string;
  ref?: string;
  fullPage?: boolean;
}

export interface WaitForOptions {
  time?: number;
  text?: string;
  textGone?: string;
}

/**
 * Base URL for the application
 */
export const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

/**
 * Common test timeouts
 */
export const TIMEOUTS = {
  SHORT: 5000,
  MEDIUM: 10000,
  LONG: 30000,
} as const;

/**
 * Sleep utility for waiting
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Page object helpers
 */
export const pages = {
  home: `${BASE_URL}/`,
  signIn: `${BASE_URL}/sign-in`,
  signUp: `${BASE_URL}/sign-up`,
  publisher: `${BASE_URL}/publisher/dashboard`,
  admin: `${BASE_URL}/admin`,
} as const;

/**
 * Common selectors
 */
export const selectors = {
  navigation: {
    logo: 'Shtetl Zmanim',
    signIn: 'Sign In',
    signUp: 'Sign Up',
  },
  home: {
    title: 'Shtetl Zmanim',
    subtitle: 'Multi-Publisher Zmanim Platform',
  },
  auth: {
    emailInput: 'Email',
    passwordInput: 'Password',
    submitButton: 'Continue',
  },
} as const;

/**
 * Test data helpers
 */
export const testData = {
  randomEmail: (): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `test-${timestamp}-${random}@example.com`;
  },

  randomString: (length: number = 10): string => {
    return Math.random().toString(36).substring(2, length + 2);
  },
};
