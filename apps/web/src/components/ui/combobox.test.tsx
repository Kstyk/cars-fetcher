import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Combobox, MultiCombobox, type ComboboxOption } from './combobox';

const MAKES: ComboboxOption[] = [
  { value: 'seat', label: 'Seat' },
  { value: 'skoda', label: 'Skoda' },
  { value: 'volkswagen', label: 'Volkswagen' },
];

describe('Combobox', () => {
  it('opens on click and lists every option', async () => {
    const user = userEvent.setup();
    render(<Combobox options={MAKES} value={null} onChange={vi.fn()} />);

    await user.click(screen.getByRole('combobox'));
    await screen.findByPlaceholderText('Szukaj…');

    expect(screen.getByText('Seat')).toBeInTheDocument();
    expect(screen.getByText('Skoda')).toBeInTheDocument();
    expect(screen.getByText('Volkswagen')).toBeInTheDocument();
  });

  it('narrows the list as the user types', async () => {
    const user = userEvent.setup();
    render(<Combobox options={MAKES} value={null} onChange={vi.fn()} />);

    await user.click(screen.getByRole('combobox'));
    await user.type(await screen.findByPlaceholderText('Szukaj…'), 'sko');

    expect(screen.getByText('Skoda')).toBeInTheDocument();
    expect(screen.queryByText('Seat')).not.toBeInTheDocument();
    expect(screen.queryByText('Volkswagen')).not.toBeInTheDocument();
  });

  it('calls onChange with the picked value and closes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Combobox options={MAKES} value={null} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('Skoda'));

    expect(onChange).toHaveBeenCalledWith('skoda');
    await waitFor(() => expect(screen.queryByPlaceholderText('Szukaj…')).not.toBeInTheDocument());
  });

  it('shows the selected label on the trigger and clears via the X button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Combobox options={MAKES} value="skoda" onChange={onChange} />);

    expect(screen.getByRole('combobox')).toHaveTextContent('Skoda');

    await user.click(screen.getByRole('button', { name: 'Wyczyść' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows the empty-state text when the search matches nothing', async () => {
    const user = userEvent.setup();
    render(<Combobox options={MAKES} value={null} onChange={vi.fn()} emptyText="Brak wyników" />);

    await user.click(screen.getByRole('combobox'));
    await user.type(await screen.findByPlaceholderText('Szukaj…'), 'nope-not-a-make');

    expect(screen.getByText('Brak wyników')).toBeInTheDocument();
  });
});

describe('MultiCombobox', () => {
  it('toggles values on and off, and summarises the count once more than two are picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <MultiCombobox options={MAKES} values={[]} onChange={onChange} />,
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('Seat'));
    expect(onChange).toHaveBeenCalledWith(['seat']);

    // Selecting a value does not auto-close a multi-select the way the
    // single-select does - close it explicitly before reading the trigger's
    // own text, since Radix's modal Popover marks everything outside it
    // (the trigger included) `aria-hidden` while open.
    await user.keyboard('{Escape}');
    rerender(<MultiCombobox options={MAKES} values={['seat', 'skoda']} onChange={onChange} />);
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('Seat, Skoda'));

    rerender(
      <MultiCombobox
        options={[...MAKES, { value: 'bmw', label: 'BMW' }]}
        values={['seat', 'skoda', 'bmw']}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('Wybrano: 3');
  });

  it('clears every selection via the footer "Wyczyść" button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MultiCombobox options={MAKES} values={['seat']} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('button', { name: /Wyczyść \(1\)/ }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
