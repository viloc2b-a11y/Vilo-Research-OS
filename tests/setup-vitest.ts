import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

(globalThis as unknown as { jest: typeof vi }).jest = vi
