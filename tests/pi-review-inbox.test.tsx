import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PIReviewPage from '../app/studies/[studyId]/pi-review/page';

describe('PI Medical Review Inbox', () => {
  it('renders page and displays only items requiring PI review', () => {
    render(<PIReviewPage />);
    
    // Page Title
    expect(screen.getByText('PI Medical Review Inbox')).toBeInTheDocument();
    
    // Abnormal AST should be there
    expect(screen.getByText(/Abnormal AST Level/i)).toBeInTheDocument();
    
    // Missing Pregnancy test should NOT be there (it's a hard stop for the CRC, not PI)
    expect(screen.queryByText(/WOCBP requires negative pregnancy test/i)).not.toBeInTheDocument();
  });

  it('allows PI to adjudicate CS with rationale', () => {
    render(<PIReviewPage />);
    
    // Get rationale inputs
    const textareas = screen.getAllByPlaceholderText(/Enter medical rationale for this decision/i);
    expect(textareas.length).toBe(4); // 4 mock items rendered

    // Fill rationale for the first item
    fireEvent.change(textareas[0], { target: { value: 'Confirmed by external lab report. Medically significant.' } });

    // Select CS
    const radioCS = screen.getAllByLabelText('CS')[0];
    fireEvent.click(radioCS);

    // Submit
    const signButton = screen.getAllByText('Sign & Adjudicate')[0];
    fireEvent.click(signButton);

    // Adjudicated text appears
    expect(screen.getByText(/Confirmed by external lab report/i)).toBeInTheDocument();
    expect(screen.getByText(/Dr. Gregory House/i)).toBeInTheDocument();
  });

  it('prevents adjudication without rationale', () => {
    // Mock window alert
    const alertMock = jest.spyOn(window, 'alert').mockImplementation();
    
    render(<PIReviewPage />);
    
    // Submit without rationale
    const signButton = screen.getAllByText('Sign & Adjudicate')[0];
    fireEvent.click(signButton);

    expect(alertMock).toHaveBeenCalledWith('Rationale is legally required for adjudication.');
    alertMock.mockRestore();
  });
});
