import { render, screen } from '@testing-library/react';
import Login from '../pages/Login';

jest.mock('react-router-dom', () => ({
    useNavigate: () => jest.fn(),
}), { virtual: true });

test('Login page renders', () => {
    render(<Login />);
    expect(screen.getByText(/login/i)).toBeInTheDocument();
});