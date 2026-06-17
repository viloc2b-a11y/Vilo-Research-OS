import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ForecastRiskBadge } from '@/components/recruitment-intelligence/ForecastRiskBadge'

describe('ForecastRiskBadge', () => {
  test('renders "On Track" for on_track risk', () => {
    render(<ForecastRiskBadge risk="on_track" />)
    expect(screen.getByText('On Track')).toBeTruthy()
  })

  test('renders "At Risk" for at_risk risk', () => {
    render(<ForecastRiskBadge risk="at_risk" />)
    expect(screen.getByText('At Risk')).toBeTruthy()
  })

  test('renders "Critical" for critical risk', () => {
    render(<ForecastRiskBadge risk="critical" />)
    expect(screen.getByText('Critical')).toBeTruthy()
  })

  test('renders "Off Track" for impossible risk', () => {
    render(<ForecastRiskBadge risk="impossible" />)
    expect(screen.getByText('Off Track')).toBeTruthy()
  })

  test('renders nothing for null risk', () => {
    const { container } = render(<ForecastRiskBadge risk={null} />)
    expect(container.firstChild).toBeNull()
  })
})
