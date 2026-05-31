import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SiteDefenseCommandCenter from '../app/studies/[studyId]/defense/page';

describe('Site Defense Command Center UI', () => {
  it('renders page and displays mock evaluated policies', () => {
    render(<SiteDefenseCommandCenter />);
    
    // Page Title
    expect(screen.getByText('Site Defense Command Center')).toBeInTheDocument();
    
    // Check if Human Review Card shows Authority Target
    expect(screen.getByText(/Human Review Required: Routing to PI/i)).toBeInTheDocument();

    // Check Financial Unknown display
    expect(screen.getByText(/Financial impact unknown — CTA\/ClinIQ required/i)).toBeInTheDocument();

    // Check Hard Stop visual distinctness exists via CSS classes (implied by rendering correctly)
    expect(screen.getByText('HARD_STOP')).toBeInTheDocument();

    // Raw AI Patterns should not be rendered (e.g. no "VIP_PAT_001" text, only translated titles)
    expect(screen.queryByText('VIP_PAT_001')).not.toBeInTheDocument();
  });

  it('allows acknowledging an item locally', () => {
    render(<SiteDefenseCommandCenter />);
    
    const ackButtons = screen.getAllByText('Acknowledge');
    expect(ackButtons.length).toBeGreaterThan(0);
    
    // Click the first acknowledge button
    fireEvent.click(ackButtons[0]);
    
    // Status should update to ACKNOWLEDGED for that item
    expect(screen.getAllByText(/Status: ACKNOWLEDGED/i).length).toBeGreaterThan(0);
  });
});
