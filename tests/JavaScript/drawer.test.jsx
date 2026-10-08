import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Drawer } from '../../resources/js/admin-product-image-discovery/components/Drawer';

describe('Drawer', () => {
  it('locks page scroll while open and restores it on close', () => {
    document.body.style.overflow = 'auto';

    const { rerender, unmount } = render(
      <Drawer open title="Request 5" onClose={vi.fn()}>
        <p>Candidates</p>
      </Drawer>,
    );

    expect(screen.getByRole('dialog', { name: 'Request 5' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Drawer open={false} title="Request 5" onClose={vi.fn()}>
        <p>Candidates</p>
      </Drawer>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('auto');

    unmount();
    document.body.style.overflow = '';
  });
});
