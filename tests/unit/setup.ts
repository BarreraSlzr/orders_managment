/**
 * Vitest jsdom setup — runs before every test in tests/unit/ and components/
 * Extends expect with jest-dom matchers (toBeInTheDocument, toHaveAttribute, etc.)
 */
import "@testing-library/jest-dom";
