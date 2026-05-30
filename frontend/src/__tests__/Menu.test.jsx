import { render, screen, waitFor } from '@testing-library/react';
import Menu from '../pages/Menu';
import axios from 'axios';

jest.mock('react-router-dom', () => ({
    useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock('axios');

test('Menu loads items', async () => {
    axios.get.mockResolvedValue({
        data: {
            Appetizers: [{ name: 'Paneer Tikka', price: 250 }]
        }
    });

    render(<Menu />);

    await waitFor(() => {
        expect(screen.getByText(/Paneer Tikka/i)).toBeInTheDocument();
    });
});